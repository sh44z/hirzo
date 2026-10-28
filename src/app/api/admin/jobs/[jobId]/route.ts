import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession, badRequest, notFound, serverError } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { JOB_POSTING_PLANS } from "@/lib/job-posting-plans";
import { Job } from "@/models/Job";
import { JobPostingPayment } from "@/models/JobPostingPayment";

const updatePlanSchema = z.object({
  postingPlan: z.enum(["basic", "premium"]),
});

type Params = { params: Promise<{ jobId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;

    const { jobId } = await params;
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return badRequest("Invalid job id");
    }
    const parsed = updatePlanSchema.safeParse(await request.json());
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message || "Invalid job plan");
    }

    await connectDB();
    const job = await Job.findById(jobId);
    if (!job) return notFound("Job not found");

    const plan = parsed.data.postingPlan;
    const amount = JOB_POSTING_PLANS[plan].amount;
    job.postingPlan = plan;
    job.postingPrice = amount;
    job.featured = plan === "premium";
    await job.save();

    await JobPostingPayment.create({
      employerId: job.employerId,
      plan,
      amount,
      status: "captured",
      paymentMethod: "offline_invoice",
      jobId: job._id,
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

    return NextResponse.json({
      job: {
        id: String(job._id),
        postingPlan: job.postingPlan,
        postingPrice: job.postingPrice,
        featured: job.featured,
      },
    });
  } catch (error) {
    console.error("Admin job plan update error:", error);
    return serverError();
  }
}
