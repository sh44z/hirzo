import { NextResponse } from "next/server";
import { requireEmployerSession, serverError } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Job } from "@/models/Job";
import { Application } from "@/models/Application";
import type { IApplication } from "@/models/Application";
import { MatchResult } from "@/models/MatchResult";
import { Assignment } from "@/models/Assignment";
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
          .select("jobId candidateName candidateEmail candidatePhone cvFileName candidateProfile status createdAt virtualInterviewQuestions virtualInterviewAnswers virtualInterviewSubmittedAt")
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
    const assignments = applications.length
      ? await (async () => {
          const now = new Date();
          await Assignment.updateMany(
            {
              employerId: session.employerId,
              status: { $in: ["sent", "in_progress"] },
              $or: [
                { invitationExpiresAt: { $lte: now } },
                { deadline: { $lte: now } },
              ],
            },
            { $set: { status: "expired" } },
          );
          return Assignment.find({
            employerId: session.employerId,
            applicationId: {
              $in: applications.map((application) => application._id),
            },
          })
            .select("applicationId status rating decision")
            .lean();
        })()
      : [];
    const scoresByApplicationId = new Map(
      matchResults.map((result) => [
        result.applicationId.toString(),
        result.score,
      ]),
    );
    const applicationsByJobId = new Map<string, typeof applications>();
    const assignmentByApplicationId = new Map(
      assignments.map((assignment) => [
        assignment.applicationId.toString(),
        assignment,
      ]),
    );
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
            const assignment = assignmentByApplicationId.get(
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
              candidateProfile: profile,
              assignment: assignment
                ? {
                    id:                     String(assignment._id),
                    status: assignment.status,
                    rating: assignment.rating,
                    decision: assignment.decision,
                  }
                : undefined,
              virtualInterviewSubmittedAt:
                application.virtualInterviewSubmittedAt,
              virtualInterviewAnswers: (
                application.virtualInterviewAnswers || []
              )
                .filter(
                  (answer: IApplication["virtualInterviewAnswers"][number]) =>
                    answer.expiresAt.getTime() > Date.now(),
                )
                .map((answer: IApplication["virtualInterviewAnswers"][number]) => ({
                  questionId: answer.questionId,
                  question:
                    (application.virtualInterviewQuestions || []).find(
                      (question: IApplication["virtualInterviewQuestions"][number]) =>
                        question.id === answer.questionId,
                    )?.question || "Video response",
                  expiresAt: answer.expiresAt,
                  videoUrl: `/api/employers/applications/${String(application._id)}/interview-videos/${encodeURIComponent(answer.questionId)}`,
                })),
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
