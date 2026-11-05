import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { badRequest, notFound, serverError } from "@/lib/auth";
import { Application } from "@/models/Application";
import type { IApplication } from "@/models/Application";
import { Employer } from "@/models/Employer";
import { Job } from "@/models/Job";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string }> };
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function getApplication(token: string) {
  if (!token || token.length > 100) return null;
  return Application.findOne({
    virtualInterviewTokenHash: hashToken(token),
    virtualInterviewTokenExpiresAt: { $gt: new Date() },
    status: "interview",
  });
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { token } = await params;
    await connectDB();
    const application = await getApplication(token);
    if (!application) return notFound("This virtual interview link is invalid or expired.");

    const [job, employer] = await Promise.all([
      Job.findById(application.jobId).select("title"),
      Employer.findById(application.employerId).select("companyName companyLogo"),
    ]);
    return NextResponse.json({
      interview: {
        status: application.virtualInterviewSubmittedAt ? "submitted" : "invited",
        candidateName: application.candidateName,
        companyName: employer?.companyName || "Employer",
        companyLogo: employer?.companyLogo
          ? `/api/employers/${application.employerId.toString()}/logo`
          : undefined,
        jobTitle: job?.title || "Role",
        questions: application.virtualInterviewQuestions,
        expiresAt: application.virtualInterviewTokenExpiresAt,
        submittedAt: application.virtualInterviewSubmittedAt,
      },
    });
  } catch (error) {
    console.error("Load candidate virtual interview error:", error);
    return serverError();
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { token } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return badRequest("Invalid interview submission.");
    await connectDB();
    const application = await getApplication(token);
    if (!application) return notFound("This virtual interview link is invalid or expired.");
    if (application.virtualInterviewSubmittedAt) {
      return NextResponse.json(
        { error: "This virtual interview has already been submitted." },
        { status: 409 },
      );
    }

    for (const question of application.virtualInterviewQuestions) {
      if (
        question.required &&
        !application.virtualInterviewAnswers.some(
          (answer: IApplication["virtualInterviewAnswers"][number]) =>
            answer.questionId === question.id &&
            answer.expiresAt.getTime() > Date.now(),
        )
      ) {
        return badRequest(`A video response is required for: ${question.question}`);
      }
    }
    if (!application.virtualInterviewAnswers.length) {
      return badRequest("Record at least one video response before submitting.");
    }

    const submittedAt = new Date();
    const submitted = await Application.findOneAndUpdate(
      {
        _id: application._id,
        virtualInterviewTokenHash: hashToken(token),
        virtualInterviewTokenExpiresAt: { $gt: submittedAt },
        virtualInterviewSubmittedAt: { $exists: false },
        status: "interview",
      },
      {
        $set: {
          virtualInterviewSubmittedAt: submittedAt,
        },
      },
      { new: true },
    );
    if (!submitted) {
      return NextResponse.json(
        { error: "This virtual interview is no longer accepting submissions." },
        { status: 410 },
      );
    }

    return NextResponse.json({
      status: "submitted",
      videosExpireAt: new Date(
        Math.min(
          ...application.virtualInterviewAnswers.map(
            (answer: IApplication["virtualInterviewAnswers"][number]) =>
              answer.expiresAt.getTime(),
          ),
        ),
      ),
    });
  } catch (error) {
    console.error("Submit candidate virtual interview error:", error);
    return serverError();
  }
}
