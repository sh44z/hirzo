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
import { assignmentTemplateSchema } from "@/lib/validations";
import { normalizeAssignmentTemplate } from "@/lib/questions";
import { Application } from "@/models/Application";
import { Assignment } from "@/models/Assignment";
import { Job } from "@/models/Job";

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

async function sendAssignmentEmail({
  email,
  candidateName,
  companyName,
  jobTitle,
  assignmentUrl,
  deadline,
}: {
  email: string;
  candidateName: string;
  companyName: string;
  jobTitle: string;
  assignmentUrl: string;
  deadline: Date;
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
        subject: `Your ${jobTitle} assignment from ${companyName}`,
        text: [
          `Hi ${candidateName},`,
          "",
          `${companyName} has invited you to complete an assignment for ${jobTitle}.`,
          `Open your secure assignment link: ${assignmentUrl}`,
          `Invitation expires: ${deadline.toLocaleString("en-GB", { timeZone: "UTC" })} UTC`,
          "",
          "You can complete the assignment without creating an account.",
        ].join("\n"),
        html: `<p>Hi ${escapeHtml(candidateName)},</p><p>${escapeHtml(companyName)} has invited you to complete an assignment for <strong>${escapeHtml(jobTitle)}</strong>.</p><p><a href="${escapeHtml(assignmentUrl)}">Open your secure assignment</a></p><p>Invitation expires: ${escapeHtml(deadline.toLocaleString("en-GB", { timeZone: "UTC" }))} UTC</p><p>You can complete the assignment without creating an account.</p>`,
      }),
    });
    if (!response.ok) {
      const details = await response.text();
      console.error("Assignment email delivery failed:", response.status, details);
      return {
        emailSent: false,
        emailMessage:
          "The assignment was created, but the email could not be delivered. Copy the secure link and send it manually.",
      };
    }
  } catch (error) {
    console.error("Assignment email delivery request failed:", error);
    return {
      emailSent: false,
      emailMessage:
        "The assignment was created, but email delivery failed. Copy the secure link and send it manually.",
    };
  }
  return { emailSent: true, emailMessage: "Assignment invitation sent by email." };
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { session, error } = await requireEmployerSession();
    if (error || !session) return error!;

    const { applicationId } = await params;
    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return badRequest("Invalid application id");
    }

    const body = await request.json();
    const requestedTemplate =
      body && typeof body === "object" && "template" in body
        ? assignmentTemplateSchema.safeParse(body.template)
        : null;
    if (requestedTemplate && !requestedTemplate.success) {
      return badRequest(
        requestedTemplate.error.issues[0]?.message || "Invalid assignment",
      );
    }

    await connectDB();
    const application = await Application.findOne({
      _id: applicationId,
      employerId: session.employerId,
    });
    if (!application) return notFound("Application not found");

    const job = await Job.findOne({
      _id: application.jobId,
      employerId: session.employerId,
    }).select("title defaultAssignment");
    if (!job) return notFound("Job not found");

    const incomingTemplate = requestedTemplate?.success
      ? requestedTemplate.data
      : job.defaultAssignment;
    const template = normalizeAssignmentTemplate(incomingTemplate);
    if (!template?.questions.length) {
      return badRequest(
        "Add assignment questions to this job or create a custom assessment first.",
      );
    }

    let assignment = await Assignment.findOne({ applicationId });
    if (
      assignment &&
      ["submitted", "reviewed"].includes(assignment.status)
    ) {
      return NextResponse.json(
        { error: "This candidate has already submitted the assignment." },
        { status: 409 },
      );
    }

    const token = nanoid(48);
    const assignedAt = new Date();
    const invitationExpiresAt = new Date(
      assignedAt.getTime() + 14 * 24 * 60 * 60 * 1000,
    );
    if (!assignment) {
      assignment = new Assignment({
        applicationId: application._id,
        jobId: application.jobId,
        employerId: application.employerId,
      });
    }
    assignment.candidateName = application.candidateName;
    assignment.candidateEmail = application.candidateEmail;
    assignment.tokenHash = hashToken(token);
    assignment.template = template;
    assignment.status = "sent";
    assignment.assignedAt = assignedAt;
    assignment.invitationExpiresAt = invitationExpiresAt;
    assignment.startedAt = undefined;
    assignment.deadline = undefined;
    assignment.answers = [];
    assignment.files = [];
    assignment.rating = undefined;
    assignment.decision = undefined;
    assignment.feedback = undefined;
    assignment.submittedAt = undefined;
    assignment.reviewedAt = undefined;
    await assignment.save();

    application.status = "shortlisted";
    await application.save();

    const assignmentUrl = new URL(
      `/assignments/${token}`,
      request.nextUrl.origin,
    ).toString();
    const email = await sendAssignmentEmail({
      email: application.candidateEmail,
      candidateName: application.candidateName,
      companyName: session.companyName,
      jobTitle: job.title,
      assignmentUrl,
      deadline: invitationExpiresAt,
    });

    return NextResponse.json({
      assignment: {
        id: assignment._id.toString(),
        status: assignment.status,
        invitationExpiresAt,
      },
      assignmentUrl,
      ...email,
    });
  } catch (error) {
    console.error("Create assignment invitation error:", error);
    return serverError();
  }
}
