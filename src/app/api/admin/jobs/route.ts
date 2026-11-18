import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdminSession, serverError } from "@/lib/auth";
import { Job } from "@/models/Job";
import { Application } from "@/models/Application";
import { Employer } from "@/models/Employer";
import { createJobSchema } from "@/lib/validations";
import { getPlatformSettings } from "@/lib/platform-settings";
import {
  normalizeAssignmentTemplate,
  normalizeQualificationQuestions,
  normalizeVirtualInterviewQuestions,
} from "@/lib/questions";
import { recordAdminAction } from "@/lib/admin-audit";
import mongoose from "mongoose";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";

const createBackofficeJobSchema = createJobSchema.extend({
  ownerType: z.enum(["hirzo", "employer", "recruiter"]),
  employerId: z.string().optional(),
}).superRefine((value, context) => {
  if (value.ownerType !== "hirzo" && !value.employerId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Choose an employer for this role",
      path: ["employerId"],
    });
  }
});

async function getBackofficeEmployer() {
  const existing = await Employer.findOne({ backofficeManaged: true });
  if (existing) return existing;

  const id = new mongoose.Types.ObjectId();
  return Employer.create({
    _id: id,
    email: `backoffice-${id.toString()}@internal.hirzo.invalid`,
    passwordHash: await hashPassword(crypto.randomUUID()),
    companyName: "Hirzo",
    contactName: "Hirzo Recruitment",
    active: true,
    status: "active",
    backofficeManaged: true,
  });
}

export async function GET() {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;
    await connectDB();
    const [jobs, counts] = await Promise.all([
      Job.find().populate("employerId", "companyName email backofficeManaged").sort({ createdAt: -1 }).lean(),
      Application.aggregate([{ $group: { _id: "$jobId", count: { $sum: 1 } } }]),
    ]);
    const applicationsByJob = new Map(counts.map((item) => [String(item._id), item.count]));
    return NextResponse.json({
      jobs: jobs.map((job) => {
        const employer = job.employerId as unknown as { _id: unknown; companyName: string; email: string } | null;
        return {
          id: String(job._id),
          title: job.title,
          description: job.description,
          status: job.status,
          moderationStatus: job.moderationStatus || (job.status === "published" ? "approved" : "pending"),
          location: job.location,
          confidential: job.confidential,
          createdAt: job.createdAt,
          applicationsCount: applicationsByJob.get(String(job._id)) || 0,
          employer: employer ? { id: String(employer._id), name: employer.companyName, email: employer.email, backofficeManaged: Boolean((employer as { backofficeManaged?: boolean }).backofficeManaged) } : null,
        };
      }),
    });
  } catch (error) {
    console.error("Admin jobs error:", error);
    return serverError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireAdminSession();
    if (error || !session) return error!;

    const parsed = createBackofficeJobSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 },
      );
    }
    if (
      parsed.data.salaryMin != null &&
      parsed.data.salaryMax != null &&
      parsed.data.salaryMin > parsed.data.salaryMax
    ) {
      return NextResponse.json(
        { error: "salaryMin cannot be greater than salaryMax" },
        { status: 400 },
      );
    }

    await connectDB();
    const employer =
      parsed.data.ownerType === "hirzo"
        ? await getBackofficeEmployer()
        : await Employer.findOne({
            _id: parsed.data.employerId,
            backofficeManaged: { $ne: true },
            active: { $ne: false },
            status: { $nin: ["paused", "suspended", "banned"] },
          });
    if (!employer) {
      return NextResponse.json(
        { error: "The selected employer is unavailable." },
        { status: 400 },
      );
    }

    const { defaultJobExpirationDays } = await getPlatformSettings();
    const job = await Job.create({
      employerId: employer._id,
      title: parsed.data.title,
      description: parsed.data.description,
      location: parsed.data.location,
      employmentType: parsed.data.employmentType,
      workplaceType: parsed.data.workplaceType,
      confidential: parsed.data.confidential,
      salaryMin: parsed.data.salaryMin,
      salaryMax: parsed.data.salaryMax,
      currency: parsed.data.currency,
      status: parsed.data.status,
      postingPlan: "basic",
      postingPrice: 0,
      expiresAt: new Date(
        Date.now() + defaultJobExpirationDays * 24 * 60 * 60 * 1000,
      ),
      moderationStatus:
        parsed.data.status === "published" ? "approved" : "pending",
      featured: false,
      qualificationQuestions: normalizeQualificationQuestions(
        parsed.data.qualificationQuestions,
      ),
      interviewQuestions: normalizeVirtualInterviewQuestions(
        parsed.data.interviewQuestions,
      ),
      defaultAssignment: normalizeAssignmentTemplate(
        parsed.data.defaultAssignment,
      ),
      requirements: parsed.data.requirements,
    });
    await recordAdminAction(
      session,
      "Created role from backoffice",
      "job",
      job.title,
      String(job._id),
      `Owner: ${employer.companyName}${job.confidential ? " · confidential" : ""}`,
    );

    return NextResponse.json(
      { job: { id: String(job._id), title: job.title } },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create backoffice job error:", error);
    return serverError();
  }
}
