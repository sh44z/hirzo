import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { nanoid } from "nanoid";
import { connectDB } from "@/lib/db";
import {
  requireEmployerSession,
  badRequest,
  notFound,
  serverError,
} from "@/lib/auth";
import { updateApplicationStatusSchema } from "@/lib/validations";
import { Application } from "@/models/Application";
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
    qualificationAnswers: app.qualificationAnswers,
    videoAnswers: app.videoAnswers,
    status: app.status,
    notes: app.notes,
    interviewToken: app.interviewToken,
    interviewTokenExpiresAt: app.interviewTokenExpiresAt,
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
    });

    if (!application) return notFound("Application not found");

    const job = await Job.findById(application.jobId).lean();

    return NextResponse.json({
      application: serializeApplication(application),
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
    });

    if (!application) return notFound("Application not found");

    application.status = parsed.data.status;
    if (parsed.data.notes !== undefined) {
      application.notes = parsed.data.notes;
    }

    if (parsed.data.status === "interview") {
      // Issue invite token for candidate email login (portal comes next)
      application.interviewToken = nanoid(32);
      application.interviewTokenExpiresAt = new Date(
        Date.now() + 1000 * 60 * 60 * 24 * 14,
      );
    } else {
      application.interviewToken = undefined;
      application.interviewTokenExpiresAt = undefined;
    }

    await application.save();

    return NextResponse.json({
      application: serializeApplication(application),
      interviewInvite:
        application.status === "interview"
          ? {
              email: application.candidateEmail,
              token: application.interviewToken,
              expiresAt: application.interviewTokenExpiresAt,
              // Candidate portal will use this later
              loginHint:
                "Candidate can log in with their email + this invite token",
            }
          : null,
    });
  } catch (error) {
    console.error("Update application error:", error);
    return serverError();
  }
}
