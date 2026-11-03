import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { notFound, serverError } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Employer } from "@/models/Employer";
import { Job } from "@/models/Job";
import { inferJobDepartment, inferWorkplaceType } from "@/lib/job-classification";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { companyId } = await params;
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return notFound("Company not found");
    }

    await connectDB();
    const employer = await Employer.findOne({
      _id: companyId,
      active: { $ne: false },
    })
      .select("companyName companyLogo companyDescription companyCulture companyBenefits")
      .lean<{
        _id: mongoose.Types.ObjectId;
        companyName: string;
        companyLogo?: string;
        companyDescription?: string;
        companyCulture?: string;
        companyBenefits?: string[];
      }>();
    if (!employer) return notFound("Company not found");

    const jobs = await Job.find({
      employerId: employer._id,
      status: "published",
      expiresAt: { $gt: new Date() },
    })
      .select("title description location employmentType workplaceType department salaryMin salaryMax currency createdAt")
      .sort({ createdAt: -1 })
      .lean<
        Array<{
          _id: mongoose.Types.ObjectId;
          title: string;
          description: string;
          location: string;
          employmentType: string;
          workplaceType?: "onsite" | "hybrid" | "remote";
          department?: import("@/types").JobDepartment;
          salaryMin?: number;
          salaryMax?: number;
          currency: string;
          createdAt: Date;
        }>
      >();

    return NextResponse.json({
      company: {
        id: employer._id.toString(),
        name: employer.companyName,
        logo: employer.companyLogo
          ? `/api/employers/${employer._id.toString()}/logo`
          : undefined,
        description: employer.companyDescription || "",
        culture: employer.companyCulture || "",
        benefits: employer.companyBenefits || [],
      },
      jobs: jobs.map((job) => ({
        id: job._id.toString(),
        title: job.title,
        description: job.description,
        location: job.location,
        employmentType: job.employmentType,
        workplaceType: inferWorkplaceType(job.workplaceType, job.location),
        department: inferJobDepartment(
          job.department,
          job.title,
          job.description,
        ),
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        currency: job.currency,
        createdAt: job.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get company profile error:", error);
    return serverError();
  }
}
