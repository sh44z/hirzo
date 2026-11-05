import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import {
  getInterviewVideoBucket,
  getInterviewVideoFile,
} from "@/lib/interview-videos";
import {
  badRequest,
  notFound,
  requireEmployerSession,
  serverError,
} from "@/lib/auth";
import { Application } from "@/models/Application";
import type { IApplication } from "@/models/Application";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ applicationId: string; questionId: string }>;
};

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { session, error } = await requireEmployerSession();
    if (error || !session) return error!;
    const { applicationId, questionId } = await params;
    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return badRequest("Invalid application id");
    }

    await connectDB();
    const application = await Application.findOne({
      _id: applicationId,
      employerId: session.employerId,
    }).select("virtualInterviewAnswers");
    if (!application) return notFound("Application not found");
    const answer = application.virtualInterviewAnswers.find(
      (item: IApplication["virtualInterviewAnswers"][number]) =>
        item.questionId === questionId,
    );
    if (!answer || answer.expiresAt.getTime() <= Date.now()) {
      return notFound("This video response has expired or is unavailable.");
    }

    const file = await getInterviewVideoFile(answer.fileId);
    if (!file) return notFound("This video response has expired or is unavailable.");
    const stream = getInterviewVideoBucket().openDownloadStream(
      new mongoose.Types.ObjectId(answer.fileId),
    );
    stream.on("error", (streamError) => {
      console.error("Stream virtual interview video error:", streamError);
    });

    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Type": answer.mimeType,
        "Content-Length": String(file.length),
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Get virtual interview video error:", error);
    return serverError();
  }
}
