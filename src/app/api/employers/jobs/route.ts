import { NextResponse } from "next/server";
import { requireEmployerSession, serverError } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Job } from "@/models/Job";

export async function GET() {
  try {
    const { session, error } = await requireEmployerSession();
    if (error || !session) return error!;

    await connectDB();

    const jobs = await Job.find({ employerId: session.employerId })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      jobs: jobs.map((job) => ({
        ...job,
        featured: job.postingPlan === "premium",
        id: String(job._id),
        employerId: job.employerId.toString(),
        _id: undefined,
      })),
    });
  } catch (error) {
    console.error("List jobs error:", error);
    return serverError();
  }
}

export async function POST() {
  try {
    const { session, error } = await requireEmployerSession();
    if (error || !session) return error!;
    return NextResponse.json(
      { error: "Choose a paid job posting plan to create a job." },
      { status: 402 },
    );
  } catch (error) {
    console.error("Create job error:", error);
    return serverError();
  }
}
