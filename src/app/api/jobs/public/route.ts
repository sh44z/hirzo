import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { serverError } from "@/lib/auth";
import { Job } from "@/models/Job";

/** Public list of published jobs (for candidate job board later). */
export async function GET() {
  try {
    await connectDB();

    const jobs = await Job.find({
      status: "published",
      expiresAt: { $gt: new Date() },
    })
      .select(
        "title description location employmentType salaryMin salaryMax currency qualificationQuestions videoQuestions requirements featured postingPlan createdAt expiresAt employerId",
      )
      .populate({
        path: "employerId",
        select: "companyName companyLogo",
        match: { active: { $ne: false } },
      })
      .sort({ featured: -1, createdAt: -1 })
      .lean();
    const rankedJobs = [...jobs].sort(
      (left, right) =>
        Number(right.postingPlan === "premium") -
          Number(left.postingPlan === "premium") ||
        right.createdAt.getTime() - left.createdAt.getTime(),
    );

    return NextResponse.json({
      jobs: rankedJobs
        .filter((job) => job.employerId)
        .map((job) => {
          const employer = job.employerId as unknown as {
            _id?: { toString(): string } | string;
            companyName?: string;
            companyLogo?: string;
          } | null;
          return {
            id: String(job._id),
            companyName: employer?.companyName || "Confidential employer",
            companyLogo:
              employer?.companyLogo && employer._id
                ? `/api/employers/${String(employer._id)}/logo`
                : undefined,
            title: job.title,
            description: job.description,
            location: job.location,
            employmentType: job.employmentType,
            salaryMin: job.salaryMin,
            salaryMax: job.salaryMax,
            currency: job.currency,
            qualificationQuestions: job.qualificationQuestions,
            videoQuestions: job.videoQuestions,
            requirements: job.requirements,
            featured: job.postingPlan === "premium",
            createdAt: job.createdAt,
            expiresAt: job.expiresAt,
          };
        }),
    });
  } catch (error) {
    console.error("Public jobs error:", error);
    return serverError();
  }
}
