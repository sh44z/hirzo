import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireEmployerSession, badRequest, notFound, serverError } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import {
  getJobPostingPrice,
  JOB_POSTING_PLANS,
  isJobPostingPlan,
} from "@/lib/job-posting-plans";
import { createPayPalOrder, getPayPalAccessToken } from "@/lib/paypal";
import { renewJobForPayment } from "@/lib/job-posting";
import { Employer } from "@/models/Employer";
import { Job } from "@/models/Job";
import { JobPostingPayment } from "@/models/JobPostingPayment";

const renewOrderSchema = z.object({
  jobId: z.string().min(1),
  plan: z.enum(["basic", "premium", "full_recruitment"]),
});

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireEmployerSession();
    if (error || !session) return error!;

    const parsed = renewOrderSchema.safeParse(await request.json());
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message || "Invalid renewal request");
    }
    if (!mongoose.Types.ObjectId.isValid(parsed.data.jobId)) {
      return badRequest("Invalid job id");
    }

    await connectDB();
    const [job, employer] = await Promise.all([
      Job.findOne({ _id: parsed.data.jobId, employerId: session.employerId }),
      Employer.findById(session.employerId).select("jobPostingDiscountPercent"),
    ]);
    if (!job) return notFound("Job not found");
    if (!employer) return notFound("Employer account not found");

    const plan = parsed.data.plan;
    if (!isJobPostingPlan(plan)) return badRequest("Invalid job posting plan");
    const amount = getJobPostingPrice(
      plan,
      employer.jobPostingDiscountPercent ?? 0,
    );
    const payment = await JobPostingPayment.create({
      employerId: new mongoose.Types.ObjectId(session.employerId),
      plan,
      amount,
      status: amount === 0 ? "captured" : "creating",
      paymentMethod: "paypal",
      renewalJobId: job._id,
      jobData: {
        title: job.title,
        description: job.description,
        location: job.location,
        employmentType: job.employmentType,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        currency: job.currency,
        status: job.status,
        qualificationQuestions: job.qualificationQuestions,
        requirements: job.requirements,
      },
    });

    if (amount === 0) {
      const renewedJob = await renewJobForPayment(payment);
      if (!renewedJob) return notFound("Job could not be renewed");
      payment.jobId = renewedJob._id;
      await payment.save();
      return NextResponse.json({
        job: {
          id: renewedJob._id.toString(),
          title: renewedJob.title,
          expiresAt: renewedJob.expiresAt,
          renewed: true,
        },
      });
    }

    const accessToken = await getPayPalAccessToken();
    const order = await createPayPalOrder(accessToken, {
      paymentId: payment._id.toString(),
      amount,
      description: `${JOB_POSTING_PLANS[plan].name} renewal — ${job.title}`,
      returnUrl: `${request.nextUrl.origin}/workspace?paypal=success`,
      cancelUrl: `${request.nextUrl.origin}/workspace?paypal=cancelled`,
    });
    payment.paypalOrderId = order.id;
    payment.status = "pending";
    await payment.save();

    return NextResponse.json({ approvalUrl: order.approvalUrl });
  } catch (error) {
    console.error("Create PayPal renewal order error:", error);
    return serverError(
      error instanceof Error &&
        error.message.startsWith("Missing PAYPAL_CLIENT")
        ? "PayPal is not configured. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET."
        : "Could not start renewal checkout. Please try again.",
    );
  }
}
