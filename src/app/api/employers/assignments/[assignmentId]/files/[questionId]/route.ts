import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import {
  badRequest,
  notFound,
  requireEmployerSession,
  serverError,
} from "@/lib/auth";
import { Assignment, type IAssignment } from "@/models/Assignment";

type Params = {
  params: Promise<{ assignmentId: string; questionId: string }>;
};

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { session, error } = await requireEmployerSession();
    if (error || !session) return error!;
    const { assignmentId, questionId } = await params;
    if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
      return badRequest("Invalid assignment id");
    }

    await connectDB();
    const assignment = await Assignment.findOne({
      _id: assignmentId,
      employerId: session.employerId,
    });
    const file = assignment?.files.find(
      (item: IAssignment["files"][number]) => item.questionId === questionId,
    );
    if (!file) return notFound("Assignment file not found");

    return new NextResponse(new Uint8Array(file.data), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename="${file.fileName.replace(/["\\\r\n]/g, "_")}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Download assignment file error:", error);
    return serverError();
  }
}
