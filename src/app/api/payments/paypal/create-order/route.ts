import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireEmployerSession, badRequest, serverError } from "@/lib/auth";
import { createPayPalOrder, getPayPalAccessToken } from "@/lib/paypal";
import { JOB_POSTING_PLANS } from "@/lib/job-posting-plans";
import { normalizeQualificationQuestions } from "@/lib/questions";
import { createPaidJobPostingSchema } from "@/lib/validations";
import { JobPostingPayment } from "@/models/JobPostingPayment";
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
    const payment = await JobPostingPayment.create({
      employerId: new mongoose.Types.ObjectId(session.employerId),
      plan: parsed.data.plan,
      amount: plan.amount,
      status: "creating",
      jobData: {
        title: parsed.data.title,
        description: parsed.data.description,
        location: parsed.data.location,
        employmentType: parsed.data.employmentType,
        salaryMin: parsed.data.salaryMin,
        salaryMax: parsed.data.salaryMax,
        currency: parsed.data.currency,
        status: parsed.data.status,
        qualificationQuestions: normalizeQualificationQuestions(
          parsed.data.qualificationQuestions,
        ),
      },
    });

    const accessToken = await getPayPalAccessToken();
    const order = await createPayPalOrder(accessToken, {
      paymentId: payment._id.toString(),
      amount: plan.amount,
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
