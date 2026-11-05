import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { nanoid } from "nanoid";
import { connectDB } from "@/lib/db";
import {
  badRequest,
  notFound,
  requireEmployerSession,
  serverError,
} from "@/lib/auth";
import { deleteInterviewVideo } from "@/lib/interview-videos";
import { Application } from "@/models/Application";
import type { IApplication } from "@/models/Application";
import { Assignment } from "@/models/Assignment";
import { Job } from "@/models/Job";
import type { IJob } from "@/models/Job";

export const runtime = "nodejs";

type Params = { params: Promise<{ applicationId: string }> };

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

async function sendInterviewEmail({
  email,
  candidateName,
  companyName,
  jobTitle,
  interviewUrl,
  expiresAt,
}: {
  email: string;
  candidateName: string;
  companyName: string;
  jobTitle: string;
  interviewUrl: string;
  expiresAt: Date;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return {
      emailSent: false,
      emailMessage:
        "Email delivery is not configured. Copy the secure link and send it to the candidate manually.",
    };
  }

  const expiry = expiresAt.toLocaleString("en-GB", { timeZone: "UTC" });
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `Your video interview for ${jobTitle}`,
        text: [
          `Hi ${candidateName},`,
          "",
          `${companyName} has invited you to complete a video interview for ${jobTitle}.`,
          `Open your secure interview link: ${interviewUrl}`,
          `Invitation expires: ${expiry} UTC`,
          "",
          "Your video responses are stored securely and automatically deleted after three days.",
        ].join("\n"),
        html: `<p>Hi ${escapeHtml(candidateName)},</p><p>${escapeHtml(companyName)} has invited you to complete a video interview for <strong>${escapeHtml(jobTitle)}</strong>.</p><p><a href="${escapeHtml(interviewUrl)}">Open your secure interview</a></p><p>Invitation expires: ${escapeHtml(expiry)} UTC.</p><p>Your video responses are automatically deleted after three days.</p>`,
      }),
    });
    if (response.ok) {
      return {
        emailSent: true,
        emailMessage: "Virtual interview invitation sent by email.",
      };
    }
    const details = await response.text();
    console.error("Virtual interview email delivery failed:", response.status, details);
  } catch (error) {
    console.error("Virtual interview email delivery request failed:", error);
  }
  return {
    emailSent: false,
    emailMessage:
      "The interview was created, but the email could not be delivered. Copy the secure link and send it manually.",
  };
}

export async function POST(request: NextRequest, { params }: Params) {
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
    if (application.status !== "shortlisted") {
      return NextResponse.json(
        { error: "Only shortlisted applicants can be invited to a video interview." },
        { status: 409 },
      );
    }

    const [job, assignment] = await Promise.all([
      Job.findOne({
        _id: application.jobId,
        employerId: session.employerId,
      }).select("title postingPlan interviewQuestions"),
      Assignment.findOne({
        applicationId: application._id,
        employerId: session.employerId,
      }).select("status decision"),
    ]);
    if (!job) return notFound("Job not found");
    if (job.postingPlan === "basic") {
      return NextResponse.json(
        { error: "Virtual interviews are available with Premium and Full Recruitment." },
        { status: 403 },
      );
    }
    if (!assignment || assignment.status !== "reviewed" || assignment.decision !== "pass") {
      return NextResponse.json(
        { error: "Review the assignment and mark it as passed before sending a video interview." },
        { status: 409 },
      );
    }
    if (!job.interviewQuestions.length) {
      return badRequest("Add virtual interview questions to this job before inviting applicants.");
    }

    await Promise.all(
      application.virtualInterviewAnswers.map(
        (answer: IApplication["virtualInterviewAnswers"][number]) =>
          deleteInterviewVideo(answer.fileId),
      ),
    );
    const token = nanoid(48);
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    application.status = "interview";
    application.virtualInterviewTokenHash = hashToken(token);
    application.virtualInterviewTokenExpiresAt = expiresAt;
    application.virtualInterviewQuestions = job.interviewQuestions.map(
      (question: IJob["interviewQuestions"][number]) => ({
        id: question.id,
        question: question.question,
        maxDurationSeconds: question.maxDurationSeconds,
        required: question.required,
      }),
    );
    application.virtualInterviewAnswers = [];
    application.virtualInterviewSubmittedAt = undefined;
    await application.save();

    const interviewUrl = new URL(
      `/virtual-interviews/${token}`,
      request.nextUrl.origin,
    ).toString();
    const email = await sendInterviewEmail({
      email: application.candidateEmail,
      candidateName: application.candidateName,
      companyName: session.companyName,
      jobTitle: job.title,
      interviewUrl,
      expiresAt,
    });

    return NextResponse.json({
      interview: {
        expiresAt,
        url: interviewUrl,
      },
      ...email,
    });
  } catch (error) {
    console.error("Create virtual interview invitation error:", error);
    return serverError();
  }
}
