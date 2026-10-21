import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireEmployerSession, badRequest, notFound, serverError } from "@/lib/auth";
import { capturePayPalOrder, getPayPalAccessToken } from "@/lib/paypal";
import { isJobPostingPlan } from "@/lib/job-posting-plans";
import { createJobForPayment } from "@/lib/job-posting";
import { paypalCaptureSchema } from "@/lib/validations";
import { JobPostingPayment } from "@/models/JobPostingPayment";
import { Job } from "@/models/Job";

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireEmployerSession();
    if (error || !session) return error!;
    const parsed = paypalCaptureSchema.safeParse(await request.json());
    if (!parsed.success) {
      return badRequest("Invalid PayPal order id");
    }
    const { orderId } = parsed.data;

    await connectDB();
    const payment = await JobPostingPayment.findOne({
      paypalOrderId: orderId,
      employerId: session.employerId,
    });
    if (!payment) return notFound("PayPal order not found");
    const postingPlan: unknown = payment.plan;
    if (!isJobPostingPlan(postingPlan)) {
      return badRequest("Invalid job posting plan for this payment");
    }
    if (payment.jobId) {
      const existingJob = await Job.findOne({
        _id: payment.jobId,
        employerId: session.employerId,
      });
      if (existingJob) {
        return NextResponse.json({
          job: { id: existingJob._id.toString(), title: existingJob.title },
        });
      }
      return notFound("This paid job post is no longer available");
    }
    if (payment.status !== "pending" && payment.status !== "captured") {
      return badRequest("This PayPal order is not ready for capture");
    }

    if (payment.status === "pending") {
      const result = await capturePayPalOrder(
        await getPayPalAccessToken(),
        orderId,
      );
      const purchaseUnit = result.purchase_units?.[0];
      const capture = purchaseUnit?.payments?.captures?.[0];
      const expectedAmount = payment.amount.toFixed(2);
      if (
        result.status !== "COMPLETED" ||
        capture?.status !== "COMPLETED" ||
        purchaseUnit?.custom_id !== payment._id.toString() ||
        capture.amount?.currency_code !== "GBP" ||
        capture.amount.value !== expectedAmount
      ) {
        return badRequest(
          "PayPal did not confirm the expected completed payment",
        );
      }
      payment.status = "captured";
      await payment.save();
    }

    const job = await createJobForPayment(payment);
    payment.jobId = job._id;
    await payment.save();

    return NextResponse.json({
      job: { id: job._id.toString(), title: job.title },
    });
  } catch (error) {
    console.error("Capture PayPal payment error:", error);
    return serverError(
      error instanceof Error &&
        error.message.startsWith("Missing PAYPAL_CLIENT")
        ? "PayPal is not configured. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET."
        : "Could not confirm your payment. Please retry from your workspace.",
    );
  }
}
