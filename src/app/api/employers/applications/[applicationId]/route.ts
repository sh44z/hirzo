import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import {
  requireEmployerSession,
  badRequest,
  notFound,
  serverError,
} from "@/lib/auth";
import { updateApplicationStatusSchema } from "@/lib/validations";
import { Application } from "@/models/Application";
import { Assignment, type IAssignment } from "@/models/Assignment";
import { Job } from "@/models/Job";

type Params = { params: Promise<{ applicationId: string }> };

function serializeApplication(app: InstanceType<typeof Application>) {
  return {
    id: app._id.toString(),
    jobId: app.jobId.toString(),
    employerId: app.employerId.toString(),
    candidateName: app.candidateName,
    candidateEmail: app.candidateEmail,
    candidatePhone: app.candidatePhone,
    cvUrl: app.cvUrl,
    cvFileName: app.cvFileName,
    cvDownloadUrl: app.cvFileName
      ? `/api/employers/applications/${app._id.toString()}/cv`
      : undefined,
    qualificationAnswers: app.qualificationAnswers,
    videoAnswers: app.videoAnswers,
    status: app.status,
    notes: app.notes,
    interviewToken: app.interviewToken,
    interviewTokenExpiresAt: app.interviewTokenExpiresAt,
    virtualInterviewStatus: app.virtualInterviewSubmittedAt
      ? "submitted"
      : app.virtualInterviewTokenHash
        ? "invited"
        : "not_invited",
    virtualInterviewSubmittedAt: app.virtualInterviewSubmittedAt,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
  };
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { session, error } = await requireEmployerSession();
    if (error || !session) return error!;

    const { applicationId } = await params;
    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return badRequest("Invalid application id");
    }

    await connectDB();

    const application = await Application.findOne({
      _id: applicationId,
      employerId: session.employerId,
    }).select("-cvFileData");

    if (!application) return notFound("Application not found");

    const assignment = await Assignment.findOne({
      applicationId: application._id,
      employerId: session.employerId,
    }).select("-tokenHash -files.data");

    const job = (await Job.findById(application.jobId).lean()) as {
      _id: { toString(): string };
      title: string;
      qualificationQuestions: unknown[];
      videoQuestions: unknown[];
    } | null;

    return NextResponse.json({
      application: serializeApplication(application),
      assignment: assignment
        ? {
            id: assignment._id.toString(),
            status: assignment.status,
            template: assignment.template,
            answers: assignment.answers,
            files: assignment.files.map(
              (file: IAssignment["files"][number]) => ({
                questionId: file.questionId,
                fileName: file.fileName,
                downloadUrl: `/api/employers/assignments/${assignment._id.toString()}/files/${encodeURIComponent(file.questionId)}`,
              }),
            ),
            rating: assignment.rating,
            decision: assignment.decision,
            feedback: assignment.feedback,
            submittedAt: assignment.submittedAt,
            reviewedAt: assignment.reviewedAt,
          }
        : null,
      job: job
        ? {
            id: job._id.toString(),
            title: job.title,
            qualificationQuestions: job.qualificationQuestions,
            videoQuestions: job.videoQuestions,
          }
        : null,
    });
  } catch (error) {
    console.error("Get application error:", error);
    return serverError();
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { session, error } = await requireEmployerSession();
    if (error || !session) return error!;

    const { applicationId } = await params;
    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return badRequest("Invalid application id");
    }

    const body = await request.json();
    const parsed = updateApplicationStatusSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message || "Invalid input");
    }

    await connectDB();

    const application = await Application.findOne({
      _id: applicationId,
      employerId: session.employerId,
    }).select("-cvFileData");

    if (!application) return notFound("Application not found");

    application.status = parsed.data.status;
    if (parsed.data.notes !== undefined) {
      application.notes = parsed.data.notes;
    }

    await application.save();

    return NextResponse.json({
      application: serializeApplication(application),
      interviewInvite: null,
    });
  } catch (error) {
    console.error("Update application error:", error);
    return serverError();
  }
}
