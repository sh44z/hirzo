import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import {
  badRequest,
  notFound,
  requireEmployerSession,
  serverError,
} from "@/lib/auth";
import { Application } from "@/models/Application";

type Params = { params: Promise<{ applicationId: string }> };

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
    }).select("cvFileName cvMimeType cvFileData");

    if (!application?.cvFileData || !application.cvFileName) {
      return notFound("CV file not found");
    }

    return new NextResponse(new Uint8Array(application.cvFileData), {
      headers: {
        "Content-Type": application.cvMimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(application.cvFileName)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Download CV error:", error);
    return serverError();
  }
}
