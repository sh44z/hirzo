import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdminSession, serverError } from "@/lib/auth";
import { Employer } from "@/models/Employer";
import { Job } from "@/models/Job";
import { Application } from "@/models/Application";

export async function GET() {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;
    await connectDB();
    const [employers, jobs, counts, applicationCounts] = await Promise.all([
      Employer.find().select("email companyName companyDescription companyCulture companyBenefits contactName active status jobPostingDiscountPercent createdAt").sort({ createdAt: -1 }).lean(),
      Job.find()
        .select("employerId title status moderationStatus postingPlan postingPrice expiresAt createdAt")
        .sort({ createdAt: -1 })
        .lean(),
      Job.aggregate([{ $group: { _id: "$employerId", count: { $sum: 1 } } }]),
      Application.aggregate([{ $group: { _id: "$employerId", count: { $sum: 1 } } }]),
    ]);
    const jobsByEmployer = new Map(counts.map((item) => [String(item._id), item.count]));
    const applicationsByEmployer = new Map(applicationCounts.map((item) => [String(item._id), item.count]));
    const jobDetailsByEmployer = new Map<string, typeof jobs>();
    for (const job of jobs) {
      const employerId = String(job.employerId);
      const employerJobs = jobDetailsByEmployer.get(employerId) || [];
      employerJobs.push(job);
      jobDetailsByEmployer.set(employerId, employerJobs);
    }
    return NextResponse.json({ employers: employers.map((employer) => ({
      id: String(employer._id), email: employer.email, companyName: employer.companyName,
      contactName: employer.contactName, active: employer.active !== false && (!employer.status || employer.status === "active"),
      status: employer.status || (employer.active === false ? "paused" : "active"),
      companyDescription: employer.companyDescription || "",
      companyCulture: employer.companyCulture || "",
      companyBenefits: employer.companyBenefits || [],
      applicationsCount: applicationsByEmployer.get(String(employer._id)) || 0,
      jobPostingDiscountPercent: employer.jobPostingDiscountPercent ?? 0,
      jobsCount: jobsByEmployer.get(String(employer._id)) || 0,
      jobs: (jobDetailsByEmployer.get(String(employer._id)) || []).map((job) => ({
        id: String(job._id),
        title: job.title,
        status: job.status,
        moderationStatus: job.moderationStatus || (job.status === "published" ? "approved" : "pending"),
        postingPlan: job.postingPlan,
        postingPrice: job.postingPrice,
        expiresAt: job.expiresAt,
        createdAt: job.createdAt,
      })),
      createdAt: employer.createdAt,
    })) });
  } catch (error) {
    console.error("Admin employers error:", error);
    return serverError();
  }
}
