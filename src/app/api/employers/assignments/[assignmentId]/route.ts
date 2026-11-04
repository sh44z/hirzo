import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import {
  badRequest,
  notFound,
  requireEmployerSession,
  serverError,
} from "@/lib/auth";
import { reviewAssignmentSchema } from "@/lib/validations";
import { Assignment, type IAssignment } from "@/models/Assignment";

type Params = { params: Promise<{ assignmentId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { session, error } = await requireEmployerSession();
    if (error || !session) return error!;
    const { assignmentId } = await params;
    if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
      return badRequest("Invalid assignment id");
    }

    await connectDB();
    const assignment = await Assignment.findOne({
      _id: assignmentId,
      employerId: session.employerId,
    }).select("-files.data -tokenHash");
    if (!assignment) return notFound("Assignment not found");

    return NextResponse.json({
      assignment: {
        id: assignment._id.toString(),
        applicationId: assignment.applicationId.toString(),
        candidateName: assignment.candidateName,
        candidateEmail: assignment.candidateEmail,
        status: assignment.status,
        template: assignment.template,
        answers: assignment.answers,
        files: assignment.files.map((file: IAssignment["files"][number]) => ({
          questionId: file.questionId,
          fileName: file.fileName,
          downloadUrl: `/api/employers/assignments/${assignment._id.toString()}/files/${encodeURIComponent(file.questionId)}`,
        })),
        rating: assignment.rating,
        decision: assignment.decision,
        feedback: assignment.feedback,
        submittedAt: assignment.submittedAt,
      },
    });
  } catch (error) {
    console.error("Get assignment review error:", error);
    return serverError();
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { session, error } = await requireEmployerSession();
    if (error || !session) return error!;
    const { assignmentId } = await params;
    if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
      return badRequest("Invalid assignment id");
    }

    const parsed = reviewAssignmentSchema.safeParse(await request.json());
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message || "Invalid scorecard.");
    }
    if (!Object.keys(parsed.data).length) {
      return badRequest("Add a rating, decision, or feedback before saving.");
    }

    await connectDB();
    const assignment = await Assignment.findOne({
      _id: assignmentId,
      employerId: session.employerId,
    });
    if (!assignment) return notFound("Assignment not found");
    if (!["submitted", "reviewed"].includes(assignment.status)) {
      return NextResponse.json(
        { error: "This assignment has not been submitted yet." },
        { status: 409 },
      );
    }

    if (parsed.data.rating !== undefined) {
      assignment.rating = parsed.data.rating ?? undefined;
    }
    if (parsed.data.decision !== undefined) {
      assignment.decision = parsed.data.decision ?? undefined;
    }
    if (parsed.data.feedback !== undefined) {
      assignment.feedback = parsed.data.feedback;
    }
    assignment.status = "reviewed";
    assignment.reviewedAt = new Date();
    await assignment.save();

    return NextResponse.json({
      assignment: {
        id: assignment._id.toString(),
        status: assignment.status,
        rating: assignment.rating,
        decision: assignment.decision,
        feedback: assignment.feedback,
      },
    });
  } catch (error) {
    console.error("Save assignment review error:", error);
    return serverError();
  }
}
