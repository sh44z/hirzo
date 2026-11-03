import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdminSession, serverError } from "@/lib/auth";
import { Job } from "@/models/Job";
import { Application } from "@/models/Application";

export async function GET() {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;
    await connectDB();
    const [jobs, counts] = await Promise.all([
      Job.find().populate("employerId", "companyName email").sort({ createdAt: -1 }).lean(),
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
          createdAt: job.createdAt,
          applicationsCount: applicationsByJob.get(String(job._id)) || 0,
          employer: employer ? { id: String(employer._id), name: employer.companyName, email: employer.email } : null,
        };
      }),
    });
  } catch (error) {
    console.error("Admin jobs error:", error);
    return serverError();
  }
}
