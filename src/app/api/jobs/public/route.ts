import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { serverError } from "@/lib/auth";
import { Job } from "@/models/Job";

/** Public list of published jobs (for candidate job board later). */
export async function GET() {
  try {
    await connectDB();

    const jobs = await Job.find({ status: "published" })
      .select(
        "title description location employmentType salaryMin salaryMax currency qualificationQuestions videoQuestions createdAt employerId",
      )
      .populate({ path: "employerId", select: "companyName", match: { active: { $ne: false } } })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      jobs: jobs.filter((job) => job.employerId).map((job) => ({
        id: String(job._id),
        companyName:
          (job.employerId as unknown as { companyName?: string } | null)
            ?.companyName || "Confidential employer",
        title: job.title,
        description: job.description,
        location: job.location,
        employmentType: job.employmentType,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        currency: job.currency,
        qualificationQuestions: job.qualificationQuestions,
        videoQuestions: job.videoQuestions,
        createdAt: job.createdAt,
      })),
    });
  } catch (error) {
    console.error("Public jobs error:", error);
    return serverError();
  }
}
