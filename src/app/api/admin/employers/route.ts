import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdminSession, serverError } from "@/lib/auth";
import { Employer } from "@/models/Employer";
import { Job } from "@/models/Job";

export async function GET() {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;
    await connectDB();
    const [employers, counts] = await Promise.all([
      Employer.find().select("email companyName contactName active jobPostingDiscountPercent createdAt").sort({ createdAt: -1 }).lean(),
      Job.aggregate([{ $group: { _id: "$employerId", count: { $sum: 1 } } }]),
    ]);
    const jobsByEmployer = new Map(counts.map((item) => [String(item._id), item.count]));
    return NextResponse.json({ employers: employers.map((employer) => ({
      id: String(employer._id), email: employer.email, companyName: employer.companyName,
      contactName: employer.contactName, active: employer.active !== false,
      jobPostingDiscountPercent: employer.jobPostingDiscountPercent ?? 0,
      jobsCount: jobsByEmployer.get(String(employer._id)) || 0, createdAt: employer.createdAt,
    })) });
  } catch (error) {
    console.error("Admin employers error:", error);
    return serverError();
  }
}
