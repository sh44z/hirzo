import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  notFound,
  requireEmployerSession,
  serverError,
} from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { calculateMatchScore } from "@/lib/job-matching";
import { Application } from "@/models/Application";
import { Job } from "@/models/Job";
import { MatchResult } from "@/models/MatchResult";
import type { CandidateProfile } from "@/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ jobId: string }> };

async function getPremiumJob(jobId: string, employerId: string) {
  return Job.findOne({
    _id: jobId,
    employerId,
    postingPlan: "premium",
  });
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { session, error } = await requireEmployerSession();
    if (error || !session) return error!;
    const { jobId } = await params;
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return badRequest("Invalid job id");
    }

    await connectDB();
    const job = await getPremiumJob(jobId, session.employerId);
    if (!job) return notFound("Premium job not found");

    const results = await MatchResult.find({
      jobId: job._id,
      employerId: session.employerId,
    })
      .sort({ score: -1, updatedAt: -1 })
      .lean();
    const applications = await Application.find({
      _id: { $in: results.map((result) => result.applicationId) },
      employerId: session.employerId,
    })
      .select("candidateName candidateEmail candidatePhone cvFileName status createdAt")
      .lean<Array<{
      _id: mongoose.Types.ObjectId;
      candidateName: string;
      candidateEmail: string;
      candidatePhone?: string;
      cvFileName?: string;
      status: string;
      createdAt: Date;
    }>>();
    const applicationById = new Map(
      applications.map((application) => [
        application._id.toString(),
        application,
      ]),
    );

    return NextResponse.json({
      job: { id: job._id.toString(), title: job.title },
      matchResults: results.flatMap((result) => {
        const application = applicationById.get(result.applicationId.toString());
        if (!application) return [];
        return [
          {
            id: application._id.toString(),
            candidateName: application.candidateName,
            candidateEmail: application.candidateEmail,
            candidatePhone: application.candidatePhone,
            cvDownloadUrl: application.cvFileName
              ? `/api/employers/applications/${application._id.toString()}/cv`
              : undefined,
            status: application.status,
            appliedAt: application.createdAt,
            score: result.score,
            breakdown: result.breakdown,
          },
        ];
      }),
    });
  } catch (error) {
    console.error("Get match results error:", error);
    return serverError();
  }
}

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const { session, error } = await requireEmployerSession();
    if (error || !session) return error!;
    const { jobId } = await params;
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return badRequest("Invalid job id");
    }

    await connectDB();
    const job = await getPremiumJob(jobId, session.employerId);
    if (!job) return notFound("Premium job not found");

    const applications = await Application.find({
      jobId: job._id,
      employerId: session.employerId,
    })
      .select("_id candidateProfile")
      .lean();
    const operations = applications.map((application) => {
      const profile: CandidateProfile = application.candidateProfile || {
        skills: [],
        yearsExperience: null,
        qualifications: [],
        responsibilities: [],
        otherRequirements: [],
      };
      const match = calculateMatchScore(
        job.requirements,
        job.matchWeights,
        profile,
      );
      return {
        updateOne: {
          filter: { applicationId: application._id },
          update: {
            $set: {
              jobId: job._id,
              employerId: job.employerId,
              ...match,
            },
          },
          upsert: true,
        },
      };
    });
    if (operations.length) {
      await MatchResult.bulkWrite(operations, { ordered: false });
    }

    return NextResponse.json({ recalculated: operations.length });
  } catch (error) {
    console.error("Recalculate match results error:", error);
    return serverError();
  }
}
