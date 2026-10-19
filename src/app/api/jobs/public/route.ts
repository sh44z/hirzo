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
        "title description location employmentType salaryMin salaryMax currency qualificationQuestions videoQuestions createdAt",
      )
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      jobs: jobs.map((job) => ({
        id: job._id.toString(),
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
