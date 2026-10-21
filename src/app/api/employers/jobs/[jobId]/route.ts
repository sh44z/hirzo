import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import {
  requireEmployerSession,
  badRequest,
  notFound,
  serverError,
} from "@/lib/auth";
import { updateJobSchema } from "@/lib/validations";
import {
  normalizeQualificationQuestions,
  normalizeVideoQuestions,
} from "@/lib/questions";
import { Job } from "@/models/Job";

type Params = { params: Promise<{ jobId: string }> };

function serializeJob(job: InstanceType<typeof Job>) {
  return {
    id: job._id.toString(),
    employerId: job.employerId.toString(),
    title: job.title,
    description: job.description,
    location: job.location,
    employmentType: job.employmentType,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    currency: job.currency,
    status: job.status,
    postingPlan: job.postingPlan,
    postingPrice: job.postingPrice,
    qualificationQuestions: job.qualificationQuestions,
    videoQuestions: job.videoQuestions,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { session, error } = await requireEmployerSession();
    if (error || !session) return error!;

    const { jobId } = await params;
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return badRequest("Invalid job id");
    }

    await connectDB();

    const job = await Job.findOne({
      _id: jobId,
      employerId: session.employerId,
    });

    if (!job) return notFound("Job not found");

    return NextResponse.json({ job: serializeJob(job) });
  } catch (error) {
    console.error("Get job error:", error);
    return serverError();
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { session, error } = await requireEmployerSession();
    if (error || !session) return error!;

    const { jobId } = await params;
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return badRequest("Invalid job id");
    }

    const body = await request.json();
    const parsed = updateJobSchema.safeParse(body);

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

    const job = await Job.findOne({
      _id: jobId,
      employerId: session.employerId,
    });

    if (!job) return notFound("Job not found");

    const updates = parsed.data;

    if (updates.title !== undefined) job.title = updates.title;
    if (updates.description !== undefined) job.description = updates.description;
    if (updates.location !== undefined) job.location = updates.location;
    if (updates.employmentType !== undefined) {
      job.employmentType = updates.employmentType;
    }
    if (updates.salaryMin !== undefined) job.salaryMin = updates.salaryMin;
    if (updates.salaryMax !== undefined) job.salaryMax = updates.salaryMax;
    if (updates.currency !== undefined) job.currency = updates.currency;
    if (updates.status !== undefined) job.status = updates.status;
    if (updates.qualificationQuestions !== undefined) {
      job.qualificationQuestions = normalizeQualificationQuestions(
        updates.qualificationQuestions,
      );
    }
    if (updates.videoQuestions !== undefined) {
      job.videoQuestions = normalizeVideoQuestions(updates.videoQuestions);
    }

    await job.save();

    return NextResponse.json({ job: serializeJob(job) });
  } catch (error) {
    console.error("Update job error:", error);
    return serverError();
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { session, error } = await requireEmployerSession();
    if (error || !session) return error!;

    const { jobId } = await params;
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return badRequest("Invalid job id");
    }

    await connectDB();

    const job = await Job.findOneAndDelete({
      _id: jobId,
      employerId: session.employerId,
    });

    if (!job) return notFound("Job not found");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete job error:", error);
    return serverError();
  }
}
