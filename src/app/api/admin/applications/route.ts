import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { badRequest, notFound, requireAdminSession, serverError } from "@/lib/auth";
import { Application } from "@/models/Application";
import { Job } from "@/models/Job";
import { updateApplicationStatusSchema } from "@/lib/validations";
import { recordAdminAction } from "@/lib/admin-audit";

export async function GET() {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;
    await connectDB();

    const applications = await Application.find()
      .select("-cvFileData")
      .populate({ path: "jobId", select: "title" })
      .populate({ path: "employerId", select: "companyName" })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    return NextResponse.json({
      applications: applications.map((application) => {
        const job = application.jobId as unknown as { _id: unknown; title: string } | null;
        const employer = application.employerId as unknown as { companyName: string } | null;
        return {
          id: String(application._id),
          candidateName: application.candidateName,
          candidateEmail: application.candidateEmail,
          candidatePhone: application.candidatePhone || "",
          status: application.status,
          createdAt: application.createdAt,
          cvDownloadUrl: application.cvFileName
            ? `/api/admin/applications/${String(application._id)}/cv`
            : undefined,
          job: job ? { id: String(job._id), title: job.title } : null,
          employerName: employer?.companyName || "Employer removed",
        };
      }),
    });
  } catch (error) {
    console.error("Admin applications error:", error);
    return serverError();
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { session, error } = await requireAdminSession();
    if (error || !session) return error!;
    const applicationId = request.nextUrl.searchParams.get("applicationId");
    if (!applicationId || !mongoose.Types.ObjectId.isValid(applicationId)) {
      return badRequest("A valid application id is required");
    }

    const parsed = updateApplicationStatusSchema.safeParse(await request.json());
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message || "Invalid status");
    }

    await connectDB();
    const application = await Application.findById(applicationId);
    if (!application) return notFound("Application not found");
    if (
      parsed.data.status === "interview" &&
      application.status !== "shortlisted" &&
      application.status !== "interview"
    ) {
      return NextResponse.json(
        { error: "Shortlist the candidate before starting an interview." },
        { status: 409 },
      );
    }

    application.status = parsed.data.status;
    if (parsed.data.notes !== undefined) application.notes = parsed.data.notes;
    await application.save();

    const job = await Job.findById(application.jobId)
      .select("title")
      .lean<{ title: string }>();
    await recordAdminAction(
      session,
      `Updated applicant status to ${parsed.data.status}`,
      "candidate",
      application.candidateName,
      String(application._id),
      job?.title || "",
    );
    return NextResponse.json({
      application: { id: String(application._id), status: application.status },
    });
  } catch (error) {
    console.error("Admin application update error:", error);
    return serverError();
  }
}
