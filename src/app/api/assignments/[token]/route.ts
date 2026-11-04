import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { badRequest, notFound, serverError } from "@/lib/auth";
import { Assignment } from "@/models/Assignment";
import { Employer } from "@/models/Employer";
import { Job } from "@/models/Job";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string }> };

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isExpired(assignment: {
  invitationExpiresAt: Date;
  deadline?: Date;
}) {
  const now = Date.now();
  return (
    assignment.invitationExpiresAt.getTime() <= now ||
    (assignment.deadline !== undefined &&
      assignment.deadline.getTime() <= now)
  );
}

async function getActiveAssignment(token: string) {
  if (!token || token.length > 100) return null;
  return Assignment.findOne({ tokenHash: hashToken(token) });
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { token } = await params;
    await connectDB();
    let assignment = await getActiveAssignment(token);
    if (!assignment) return notFound("Assignment link is invalid or unavailable.");

    if (
      ["sent", "in_progress"].includes(assignment.status) &&
      isExpired(assignment)
    ) {
      const expiredAssignment = await Assignment.findOneAndUpdate(
        {
          _id: assignment._id,
          status: { $in: ["sent", "in_progress"] },
          $or: [
            { invitationExpiresAt: { $lte: new Date() } },
            { deadline: { $lte: new Date() } },
          ],
        },
        { $set: { status: "expired" } },
        { new: true },
      );
      if (expiredAssignment) assignment = expiredAssignment;
    }

    if (assignment.status === "sent") {
      const startedAt = new Date();
      const update: {
        status: "in_progress";
        startedAt: Date;
        deadline?: Date;
      } = {
        status: "in_progress",
        startedAt,
      };
      if (assignment.template.timeLimitHours) {
        update.deadline = new Date(
          startedAt.getTime() +
            assignment.template.timeLimitHours * 60 * 60 * 1000,
        );
      }
      const startedAssignment = await Assignment.findOneAndUpdate(
        {
          _id: assignment._id,
          status: "sent",
          invitationExpiresAt: { $gt: startedAt },
        },
        { $set: update },
        { new: true },
      );
      assignment =
        startedAssignment || (await getActiveAssignment(token));
      if (!assignment) {
        return notFound("Assignment link is invalid or unavailable.");
      }
    }
    if (
      ["sent", "in_progress"].includes(assignment.status) &&
      isExpired(assignment)
    ) {
      const expiredAssignment = await Assignment.findOneAndUpdate(
        {
          _id: assignment._id,
          status: { $in: ["sent", "in_progress"] },
          $or: [
            { invitationExpiresAt: { $lte: new Date() } },
            { deadline: { $lte: new Date() } },
          ],
        },
        { $set: { status: "expired" } },
        { new: true },
      );
      if (expiredAssignment) assignment = expiredAssignment;
    }

    const job = await Job.findById(assignment.jobId).select("title");
    const employer = await Employer.findById(assignment.employerId).select(
      "companyName companyLogo",
    );

    return NextResponse.json({
      assignment: {
        status: assignment.status,
        instructions: assignment.template.instructions,
        questions: assignment.template.questions,
        answers: assignment.answers,
        startedAt: assignment.startedAt,
        deadline: assignment.deadline,
        expiresAt: assignment.deadline || assignment.invitationExpiresAt,
        candidateName: assignment.candidateName,
        companyName: employer?.companyName || "Employer",
        companyLogo: employer?.companyLogo
          ? `/api/employers/${assignment.employerId.toString()}/logo`
          : undefined,
        jobTitle: job?.title || "Role",
      },
    });
  } catch (error) {
    console.error("Load candidate assignment error:", error);
    return serverError();
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { token } = await params;
    let rawAnswers: unknown;
    const uploads: Array<{
      questionId: string;
      fileName: string;
      mimeType: string;
      data: Buffer;
    }> = [];

    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      try {
        rawAnswers = JSON.parse(String(form.get("answers") || "[]"));
      } catch {
        return badRequest("Invalid assignment answers.");
      }
      let totalUploadBytes = 0;
      for (const [field, value] of form.entries()) {
        if (!field.startsWith("file:") || !(value instanceof File)) continue;
        if (!value.size || value.size > 8 * 1024 * 1024) {
          return badRequest("Each assignment file must be no larger than 8 MB.");
        }
        totalUploadBytes += value.size;
        if (totalUploadBytes > 12 * 1024 * 1024) {
          return badRequest("Assignment files must total no more than 12 MB.");
        }
        const extension = value.name.split(".").pop()?.toLowerCase() || "";
        const data = Buffer.from(await value.arrayBuffer());
        const signatureMatches: Record<string, boolean> = {
          pdf: data.subarray(0, 5).toString() === "%PDF-",
          zip: data[0] === 0x50 && data[1] === 0x4b,
          docx: data[0] === 0x50 && data[1] === 0x4b,
          pptx: data[0] === 0x50 && data[1] === 0x4b,
          png: data.subarray(0, 8).equals(
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          ),
          jpg: data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff,
          jpeg: data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff,
        };
        if (!signatureMatches[extension]) {
          return badRequest(
            "Assignment files must be a valid PDF, ZIP, DOCX, PPTX, PNG, or JPEG.",
          );
        }
        const fileName = value.name
          .split(/[\\/]/)
          .pop()!
          .replace(/[\u0000-\u001f\u007f]/g, "")
          .slice(0, 255);
        uploads.push({
          questionId: field.slice(5),
          fileName,
          mimeType:
            extension === "pdf"
              ? "application/pdf"
              : extension === "zip"
                ? "application/zip"
                : extension === "docx"
                  ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  : extension === "pptx"
                    ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    : extension === "png"
                      ? "image/png"
                      : "image/jpeg",
          data,
        });
      }
    } else {
      const body = await request.json();
      rawAnswers = body?.answers;
    }

    if (
      !Array.isArray(rawAnswers) ||
      rawAnswers.some(
        (answer) =>
          !answer ||
          typeof answer.questionId !== "string" ||
          typeof answer.answer !== "string",
      )
    ) {
      return badRequest("Invalid assignment answers.");
    }
    const submittedAnswers = rawAnswers as Array<{
      questionId: string;
      answer: string;
    }>;

    await connectDB();
    const assignment = await getActiveAssignment(token);
    if (!assignment) return notFound("Assignment link is invalid or unavailable.");
    if (assignment.status !== "in_progress" || isExpired(assignment)) {
      if (assignment.status === "in_progress") {
        assignment.status = "expired";
        await assignment.save();
      }
      return NextResponse.json(
        { error: "This assignment is no longer accepting submissions." },
        { status: 410 },
      );
    }

    const questions = assignment.template.questions as Array<{
      id: string;
      question: string;
      type: string;
      options?: string[];
      required: boolean;
    }>;
    const questionIds = new Set(questions.map((question) => question.id));
    if (
      submittedAnswers.some((answer) =>
        !questionIds.has(answer.questionId),
      ) ||
      uploads.some((upload) => !questionIds.has(upload.questionId))
    ) {
      return badRequest("An answer does not match this assignment.");
    }

    if (
      new Set(submittedAnswers.map((answer) => answer.questionId)).size !==
      submittedAnswers.length
    ) {
      return badRequest("A question can only have one answer.");
    }
    if (
      new Set(uploads.map((upload) => upload.questionId)).size !==
      uploads.length
    ) {
      return badRequest("A question can only have one uploaded file.");
    }

    const answers: Array<{ questionId: string; answer: string }> = [];
    for (const question of questions) {
      const value = submittedAnswers.find(
        (answer) => answer.questionId === question.id,
      );
      const answer = value?.answer.trim() || "";
      const file = uploads.find((upload) => upload.questionId === question.id);
      if (question.required && question.type === "file_upload" && !file) {
        return badRequest(`${question.question} requires a file.`);
      }
      if (question.required && question.type !== "file_upload" && !answer) {
        return badRequest(`${question.question} is required.`);
      }
      if (answer.length > 10000) {
        return badRequest("Text answers must be no longer than 10,000 characters.");
      }
      if (
        question.type === "multiple_choice" &&
        answer &&
        !question.options?.includes(answer)
      ) {
        return badRequest(`Choose an available option for: ${question.question}`);
      }
      if (question.type === "video_link" && answer) {
        try {
          const url = new URL(answer);
          if (!["http:", "https:"].includes(url.protocol)) throw new Error();
        } catch {
          return badRequest(`Enter a valid video link for: ${question.question}`);
        }
      }
      if (question.type !== "file_upload" && answer) {
        answers.push({ questionId: question.id, answer });
      }
    }

    const submittedAt = new Date();
    const submitted = await Assignment.findOneAndUpdate(
      {
        _id: assignment._id,
        tokenHash: hashToken(token),
        status: "in_progress",
        invitationExpiresAt: { $gt: submittedAt },
        $or: [
          { deadline: { $exists: false } },
          { deadline: { $gt: submittedAt } },
        ],
      },
      {
        $set: {
          answers,
          files: uploads,
          status: "submitted",
          submittedAt,
        },
      },
      { new: true },
    );
    if (!submitted) {
      return NextResponse.json(
        { error: "This assignment is no longer accepting submissions." },
        { status: 410 },
      );
    }

    return NextResponse.json({ status: submitted.status });
  } catch (error) {
    console.error("Submit candidate assignment error:", error);
    return serverError();
  }
}
