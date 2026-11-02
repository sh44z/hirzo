import { NextResponse } from "next/server";
import { requireEmployerSession, serverError } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Job } from "@/models/Job";
import { Application } from "@/models/Application";
import { MatchResult } from "@/models/MatchResult";
import { calculateMatchScore } from "@/lib/job-matching";
import type { CandidateProfile } from "@/types";

export async function GET() {
  try {
    const { session, error } = await requireEmployerSession();
    if (error || !session) return error!;

    await connectDB();

    const jobs = await Job.find({ employerId: session.employerId })
      .sort({ createdAt: -1 })
      .lean();
    const applications = jobs.length
      ? await Application.find({
          employerId: session.employerId,
          jobId: { $in: jobs.map((job) => job._id) },
        })
          .select("jobId candidateName candidateEmail candidatePhone cvFileName candidateProfile status createdAt")
          .sort({ createdAt: -1 })
          .lean()
      : [];
    const matchResults = applications.length
      ? await MatchResult.find({
          employerId: session.employerId,
          applicationId: { $in: applications.map((application) => application._id) },
        })
          .select("applicationId score")
          .lean()
      : [];
    const scoresByApplicationId = new Map(
      matchResults.map((result) => [
        result.applicationId.toString(),
        result.score,
      ]),
    );
    const applicationsByJobId = new Map<string, typeof applications>();
    for (const application of applications) {
      const key = String(application.jobId);
      const jobApplications = applicationsByJobId.get(key) || [];
      jobApplications.push(application);
      applicationsByJobId.set(key, jobApplications);
    }

    return NextResponse.json({
      jobs: jobs.map((job) => ({
        ...job,
        featured: job.postingPlan === "premium",
        id: String(job._id),
        employerId: job.employerId.toString(),
        applicants: (applicationsByJobId.get(String(job._id)) || []).map(
          (application) => {
            const profile: CandidateProfile | undefined =
              application.candidateProfile;
            const storedScore = scoresByApplicationId.get(
              String(application._id),
            );
            const score =
              job.postingPlan === "premium" && profile
                ? storedScore ??
                  calculateMatchScore(job.requirements, profile)
                : undefined;
            return {
              id: String(application._id),
              candidateName: application.candidateName,
              candidateEmail: application.candidateEmail,
              candidatePhone: application.candidatePhone,
              cvDownloadUrl: application.cvFileName
                ? `/api/employers/applications/${String(application._id)}/cv`
                : undefined,
              status: application.status,
              createdAt: application.createdAt,
              score,
              hasScannedCv: Boolean(profile),
            };
          },
        ),
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
