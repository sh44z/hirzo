import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { badRequest, notFound, serverError } from "@/lib/auth";
import {
  deleteInterviewVideo,
  INTERVIEW_VIDEO_RETENTION_MS,
  saveInterviewVideoChunks,
} from "@/lib/interview-videos";
import { Application } from "@/models/Application";
import type { IApplication } from "@/models/Application";
import { InterviewVideoChunk } from "@/models/InterviewVideoChunk";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string; questionId: string }> };
const MAX_CHUNK_BYTES = 3 * 1024 * 1024;
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function getApplication(token: string) {
  if (!token || token.length > 100) return null;
  return Application.findOne({
    virtualInterviewTokenHash: hashToken(token),
    virtualInterviewTokenExpiresAt: { $gt: new Date() },
    status: "interview",
    virtualInterviewSubmittedAt: { $exists: false },
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { token, questionId } = await params;
    if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
      return badRequest("Upload a video chunk as a multipart form.");
    }
    const form = await request.formData();
    const video = form.get("video");
    const uploadId = String(form.get("uploadId") || "");
    const mimeType = String(form.get("mimeType") || "");
    const chunkIndex = Number(form.get("chunkIndex"));
    const totalChunks = Number(form.get("totalChunks"));
    if (
      !(video instanceof File) ||
      video.size === 0 ||
      video.size > MAX_CHUNK_BYTES ||
      !/^[a-zA-Z0-9-]{1,60}$/.test(uploadId) ||
      !Number.isInteger(chunkIndex) ||
      !Number.isInteger(totalChunks) ||
      totalChunks < 1 ||
      totalChunks > 10 ||
      chunkIndex < 0 ||
      chunkIndex >= totalChunks ||
      totalChunks * MAX_CHUNK_BYTES > MAX_VIDEO_BYTES ||
      !["video/webm", "video/mp4"].includes(mimeType)
    ) {
      return badRequest("Invalid video upload chunk.");
    }

    await connectDB();
    const application = await getApplication(token);
    if (!application) return notFound("This virtual interview link is invalid or expired.");
    const question = application.virtualInterviewQuestions.find(
      (item: IApplication["virtualInterviewQuestions"][number]) =>
        item.id === questionId,
    );
    if (!question) return badRequest("This question is not part of the interview.");

    const expiresAt = new Date(Date.now() + INTERVIEW_VIDEO_RETENTION_MS);
    await InterviewVideoChunk.updateOne(
      {
        applicationId: application._id,
        questionId,
        uploadId,
        chunkIndex,
      },
      {
        $set: {
          totalChunks,
          mimeType,
          data: Buffer.from(await video.arrayBuffer()),
          expiresAt,
        },
        $setOnInsert: {
          applicationId: application._id,
          questionId,
          uploadId,
          chunkIndex,
        },
      },
      { upsert: true, runValidators: true },
    );
    const receivedChunks = await InterviewVideoChunk.countDocuments({
      applicationId: application._id,
      questionId,
      uploadId,
    });
    return NextResponse.json({ uploaded: false, receivedChunks, totalChunks });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Video upload is incomplete" ||
        error.message === "Video format could not be validated" ||
        error.message === "Video upload chunks are inconsistent")
    ) {
      return badRequest(error.message);
    }
    console.error("Upload virtual interview video chunk error:", error);
    return serverError();
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { token, questionId } = await params;
    const body = await request.json();
    const uploadId = String(body.uploadId || "");
    const mimeType = String(body.mimeType || "");
    const totalChunks = Number(body.totalChunks);
    if (
      !/^[a-zA-Z0-9-]{1,60}$/.test(uploadId) ||
      !Number.isInteger(totalChunks) ||
      totalChunks < 1 ||
      totalChunks > 10 ||
      totalChunks * MAX_CHUNK_BYTES > MAX_VIDEO_BYTES ||
      !["video/webm", "video/mp4"].includes(mimeType)
    ) {
      return badRequest("Invalid video upload details.");
    }

    await connectDB();
    const application = await getApplication(token);
    if (!application) return notFound("This virtual interview link is invalid or expired.");
    if (
      !application.virtualInterviewQuestions.some(
        (item: IApplication["virtualInterviewQuestions"][number]) =>
          item.id === questionId,
      )
    ) {
      return badRequest("This question is not part of the interview.");
    }
    const saved = await saveInterviewVideoChunks({
      applicationId: application._id.toString(),
      questionId,
      uploadId,
      totalChunks,
      mimeType,
    });
    const previousAnswer = application.virtualInterviewAnswers.find(
      (answer: IApplication["virtualInterviewAnswers"][number]) =>
        answer.questionId === questionId,
    );
    application.virtualInterviewAnswers = [
      ...application.virtualInterviewAnswers.filter(
        (answer: IApplication["virtualInterviewAnswers"][number]) =>
          answer.questionId !== questionId,
      ),
      {
        questionId,
        fileId: saved.fileId,
        mimeType,
        expiresAt: saved.expiresAt,
      },
    ];
    await application.save();
    await InterviewVideoChunk.deleteMany({
      applicationId: application._id,
      questionId,
      uploadId,
    });
    if (previousAnswer) await deleteInterviewVideo(previousAnswer.fileId);
    return NextResponse.json({ uploaded: true, expiresAt: saved.expiresAt });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Video upload is incomplete" ||
        error.message === "Video format could not be validated" ||
        error.message === "Video upload chunks are inconsistent")
    ) {
      return badRequest(error.message);
    }
    console.error("Finalize virtual interview video upload error:", error);
    return serverError();
  }
}
