import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession, badRequest, notFound, serverError } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { JOB_POSTING_PLANS } from "@/lib/job-posting-plans";
import { Job } from "@/models/Job";
import { JobPostingPayment } from "@/models/JobPostingPayment";
import { Application } from "@/models/Application";
import { Assignment } from "@/models/Assignment";
import { MatchResult } from "@/models/MatchResult";
import { recordAdminAction } from "@/lib/admin-audit";
import { updateJobSchema } from "@/lib/validations";
import {
  normalizeQualificationQuestions,
  normalizeVideoQuestions,
  normalizeVirtualInterviewQuestions,
  normalizeAssignmentTemplate,
} from "@/lib/questions";

const updateSchema = z.union([
  z.object({ postingPlan: z.enum(["basic", "premium"]) }),
  z.object({ moderationStatus: z.enum(["approved", "flagged", "removed"]) }),
  updateJobSchema
    .strict()
    .refine((updates) => Object.keys(updates).length > 0, "Provide at least one job field to update"),
]);

type Params = { params: Promise<{ jobId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { session, error } = await requireAdminSession();
    if (error || !session) return error!;

    const { jobId } = await params;
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return badRequest("Invalid job id");
    }

    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message || "Invalid job plan");
    }

    await connectDB();
    const job = await Job.findById(jobId);
    if (!job) return notFound("Job not found");

    if ("moderationStatus" in parsed.data) {
      job.moderationStatus = parsed.data.moderationStatus;
      if (parsed.data.moderationStatus === "removed") job.status = "closed";
      await job.save();
      await recordAdminAction(session, `Set job moderation to ${parsed.data.moderationStatus}`, "job", job.title, jobId);
      return NextResponse.json({ job: { id: String(job._id), moderationStatus: job.moderationStatus, status: job.status } });
    }

    if (!("postingPlan" in parsed.data)) {
      const updates = parsed.data;
      const salaryMin = updates.salaryMin === undefined ? job.salaryMin : updates.salaryMin;
      const salaryMax = updates.salaryMax === undefined ? job.salaryMax : updates.salaryMax;
      if (salaryMin != null && salaryMax != null && salaryMin > salaryMax) {
        return NextResponse.json(
          { error: "salaryMin cannot be greater than salaryMax" },
          { status: 400 },
        );
      }

      if (updates.title !== undefined) job.title = updates.title;
      if (updates.description !== undefined) job.description = updates.description;
      if (updates.location !== undefined) job.location = updates.location;
      if (updates.employmentType !== undefined) job.employmentType = updates.employmentType;
      if (updates.workplaceType !== undefined) job.workplaceType = updates.workplaceType;
      if (updates.confidential !== undefined) job.confidential = updates.confidential;
      if (updates.salaryMin === null) job.salaryMin = undefined;
      else if (updates.salaryMin !== undefined) job.salaryMin = updates.salaryMin;
      if (updates.salaryMax === null) job.salaryMax = undefined;
      else if (updates.salaryMax !== undefined) job.salaryMax = updates.salaryMax;
      if (updates.currency !== undefined) job.currency = updates.currency;
      if (updates.status !== undefined) job.status = updates.status;
      if (updates.qualificationQuestions !== undefined) {
        job.qualificationQuestions = normalizeQualificationQuestions(updates.qualificationQuestions);
      }
      if (updates.videoQuestions !== undefined) {
        job.videoQuestions = normalizeVideoQuestions(updates.videoQuestions);
      }
      if (updates.interviewQuestions !== undefined) {
        job.interviewQuestions = normalizeVirtualInterviewQuestions(updates.interviewQuestions);
      }
      if (updates.defaultAssignment !== undefined) {
        job.defaultAssignment = normalizeAssignmentTemplate(updates.defaultAssignment ?? undefined);
      }
      if (updates.requirements !== undefined) job.requirements = updates.requirements;

      await job.save();
      await recordAdminAction(session, "Edited job from backoffice", "job", job.title, jobId);
      return NextResponse.json({ job: { id: String(job._id), title: job.title } });
    }

    const plan = parsed.data.postingPlan;
    const amount = JOB_POSTING_PLANS[plan].amount;
    job.postingPlan = plan;
    job.postingPrice = amount;
    job.featured = plan === "premium";
    await job.save();
    await recordAdminAction(session, `Updated posting plan to ${plan}`, "job", job.title, jobId);

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

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { session, error } = await requireAdminSession();
    if (error || !session) return error!;

    const { jobId } = await params;
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return badRequest("Invalid job id");
    }

    await connectDB();
    const job = await Job.findById(jobId);
    if (!job) return notFound("Job not found");

    const applications = await Application.find({ jobId: job._id })
      .select("_id")
      .lean();
    const applicationIds = applications.map((application) => application._id);

    await recordAdminAction(
      session,
      "Deleted job and related applications",
      "job",
      job.title,
      jobId,
      `${applicationIds.length} application${applicationIds.length === 1 ? "" : "s"} deleted`,
    );
    await Promise.all([
      Assignment.deleteMany({
        $or: [{ jobId: job._id }, { applicationId: { $in: applicationIds } }],
      }),
      MatchResult.deleteMany({
        $or: [{ jobId: job._id }, { applicationId: { $in: applicationIds } }],
      }),
      Application.deleteMany({ jobId: job._id }),
      JobPostingPayment.deleteMany({
        $or: [{ jobId: job._id }, { renewalJobId: job._id }],
      }),
      Job.findByIdAndDelete(job._id),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin job deletion error:", error);
    return serverError();
  }
}
