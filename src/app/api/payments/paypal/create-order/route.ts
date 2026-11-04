import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireEmployerSession, badRequest, serverError } from "@/lib/auth";
import { createPayPalOrder, getPayPalAccessToken } from "@/lib/paypal";
import {
  getJobPostingPrice,
  JOB_POSTING_PLANS,
} from "@/lib/job-posting-plans";
import { createJobForPayment } from "@/lib/job-posting";
import { normalizeQualificationQuestions } from "@/lib/questions";
import { createPaidJobPostingSchema } from "@/lib/validations";
import { JobPostingPayment } from "@/models/JobPostingPayment";
import { Employer } from "@/models/Employer";
import { Job } from "@/models/Job";
import { connectDB } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireEmployerSession();
    if (error || !session) return error!;

    const parsed = createPaidJobPostingSchema.safeParse(await request.json());
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message || "Invalid input");
    }
    if (
      parsed.data.salaryMin != null &&
      parsed.data.salaryMax != null &&
      parsed.data.salaryMin > parsed.data.salaryMax
    ) {
      return badRequest("salaryMin cannot be greater than salaryMax");
    }

    await connectDB();
    const plan = JOB_POSTING_PLANS[parsed.data.plan];
    const employer = await Employer.findById(session.employerId).select("_id");
    if (!employer) return badRequest("Employer account not found");
    const amount = getJobPostingPrice(parsed.data.plan);
    const creditEligible = parsed.data.plan === "basic" || parsed.data.plan === "premium";
    if (parsed.data.creditExpected && !creditEligible) {
      return badRequest("Free posting credits can only be used for Basic or Premium jobs");
    }

    const creditUsed = creditEligible
      ? Boolean(
          await Employer.findOneAndUpdate(
            {
              _id: session.employerId,
              [`jobPostingCredits.${parsed.data.plan}`]: { $gt: 0 },
            },
            { $inc: { [`jobPostingCredits.${parsed.data.plan}`]: -1 } },
            { new: true },
          ),
        )
      : false;
    if (parsed.data.creditExpected && !creditUsed) {
      return NextResponse.json(
        { error: "That free posting credit has already been used. Refresh and try again." },
        { status: 409 },
      );
    }

    const paymentInput = {
      employerId: new mongoose.Types.ObjectId(session.employerId),
      plan: parsed.data.plan,
      amount: creditUsed ? 0 : amount,
      status: creditUsed ? ("captured" as const) : ("creating" as const),
      paymentMethod: creditUsed ? ("credit" as const) : ("paypal" as const),
      jobData: {
        title: parsed.data.title,
        description: parsed.data.description,
        location: parsed.data.location,
        employmentType: parsed.data.employmentType,
        workplaceType: parsed.data.workplaceType,
        salaryMin: parsed.data.salaryMin,
        salaryMax: parsed.data.salaryMax,
        currency: parsed.data.currency,
        status: parsed.data.status,
        qualificationQuestions: normalizeQualificationQuestions(
          parsed.data.qualificationQuestions,
        ),
        requirements: parsed.data.requirements,
      },
    };
    let payment;
    try {
      payment = await JobPostingPayment.create(paymentInput);
    } catch (error) {
      if (creditUsed) {
        await Employer.updateOne(
          { _id: session.employerId },
          { $inc: { [`jobPostingCredits.${parsed.data.plan}`]: 1 } },
        );
      }
      throw error;
    }

    if (creditUsed) {
      try {
        const job = await createJobForPayment(payment);
        payment.jobId = job._id;
        await payment.save();
        return NextResponse.json({
          job: { id: job._id.toString(), title: job.title },
          freePostCredit: true,
        });
      } catch (error) {
        const existingJob = await Job.exists({ paymentId: payment._id });
        if (!existingJob) {
          await Employer.updateOne(
            { _id: session.employerId },
            { $inc: { [`jobPostingCredits.${parsed.data.plan}`]: 1 } },
          );
          await JobPostingPayment.updateOne(
            { _id: payment._id },
            { $set: { status: "failed" } },
          );
        }
        throw error;
      }
    }

    const accessToken = await getPayPalAccessToken();
    const order = await createPayPalOrder(accessToken, {
      paymentId: payment._id.toString(),
      amount,
      description: `${plan.name} — ${parsed.data.title}`,
      returnUrl: `${request.nextUrl.origin}/workspace?paypal=success`,
      cancelUrl: `${request.nextUrl.origin}/workspace?paypal=cancelled`,
    });
    payment.paypalOrderId = order.id;
    payment.status = "pending";
    await payment.save();

    return NextResponse.json({ approvalUrl: order.approvalUrl });
  } catch (error) {
    console.error("Create PayPal order error:", error);
    return serverError(
      error instanceof Error &&
        error.message.startsWith("Missing PAYPAL_CLIENT")
        ? "PayPal is not configured. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET."
        : "Could not start PayPal checkout. Please try again.",
    );
  }
}
