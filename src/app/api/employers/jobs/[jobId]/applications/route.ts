import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import {
  requireEmployerSession,
  badRequest,
  notFound,
  serverError,
} from "@/lib/auth";
import { Job } from "@/models/Job";
import { Application } from "@/models/Application";
import type { ApplicationStatus } from "@/types";

type Params = { params: Promise<{ jobId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { session, error } = await requireEmployerSession();
    if (error || !session) return error!;

    const { jobId } = await params;
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return badRequest("Invalid job id");
    }

    await connectDB();

    const job = await Job.findOne({
      _id: jobId,
      employerId: session.employerId,
    }).lean();

    if (!job) return notFound("Job not found");

    const status = request.nextUrl.searchParams.get("status") as
      | ApplicationStatus
      | null;

    const filter: Record<string, unknown> = {
      jobId,
      employerId: session.employerId,
    };

    if (
      status &&
      ["applied", "shortlisted", "interview", "hired", "rejected"].includes(
        status,
      )
    ) {
      filter.status = status;
    }

    const applications = await Application.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      job: {
        id: job._id.toString(),
        title: job.title,
        status: job.status,
      },
      applications: applications.map((app) => ({
        id: app._id.toString(),
        jobId: app.jobId.toString(),
        employerId: app.employerId.toString(),
        candidateName: app.candidateName,
        candidateEmail: app.candidateEmail,
        candidatePhone: app.candidatePhone,
        cvUrl: app.cvUrl,
        cvFileName: app.cvFileName,
        qualificationAnswers: app.qualificationAnswers,
        videoAnswers: app.videoAnswers,
        status: app.status,
        notes: app.notes,
        interviewTokenExpiresAt: app.interviewTokenExpiresAt,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
      })),
    });
  } catch (error) {
    console.error("List applications error:", error);
    return serverError();
  }
}
