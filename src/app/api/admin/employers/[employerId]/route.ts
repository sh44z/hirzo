import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { badRequest, notFound, requireAdminSession, serverError, createSessionToken, setSessionCookie, hashPassword } from "@/lib/auth";
import { Employer } from "@/models/Employer";
import { Job } from "@/models/Job";
import { Application } from "@/models/Application";
import { MatchResult } from "@/models/MatchResult";
import { JobPostingPayment } from "@/models/JobPostingPayment";
import { recordAdminAction } from "@/lib/admin-audit";
import { randomBytes } from "node:crypto";

const updateSchema = z
  .object({
    active: z.boolean().optional(),
    status: z.enum(["active", "paused", "pending_verification", "suspended", "banned"]).optional(),
    jobPostingDiscountPercent: z.number().int().min(0).max(100).optional(),
  })
  .refine(
    (value) =>
      value.active !== undefined ||
      value.status !== undefined ||
      value.jobPostingDiscountPercent !== undefined,
    "Provide an account status or discount",
  );
type Params = { params: Promise<{ employerId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { session, error } = await requireAdminSession();
    if (error || !session) return error!;
    const { employerId } = await params;
    if (!mongoose.Types.ObjectId.isValid(employerId)) return badRequest("Invalid employer id");
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || "Invalid employer update");
    await connectDB();
    const changes = { ...parsed.data };
    if (changes.status !== undefined) changes.active = changes.status === "active";
    else if (changes.active !== undefined) changes.status = changes.active ? "active" : "paused";
    const employer = await Employer.findByIdAndUpdate(employerId, changes, { new: true })
      .select("email companyName active status jobPostingDiscountPercent");
    if (!employer) return notFound("Employer not found");
    const action = changes.jobPostingDiscountPercent !== undefined
      ? "Updated posting discount"
      : `Set account status to ${changes.status}`;
    await recordAdminAction(session, action, "employer", employer.companyName, employerId);
    return NextResponse.json({ employer: {
      id: String(employer._id), email: employer.email, companyName: employer.companyName,
      active: employer.active,
      status: employer.status || (employer.active ? "active" : "paused"),
      jobPostingDiscountPercent: employer.jobPostingDiscountPercent ?? 0,
    } });
  } catch (error) {
    console.error("Admin employer update error:", error);
    return serverError();
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { session, error } = await requireAdminSession();
    if (error || !session) return error!;
    const { employerId } = await params;
    if (!mongoose.Types.ObjectId.isValid(employerId)) return badRequest("Invalid employer id");
    const body = z.object({ action: z.enum(["impersonate", "reset_password"]) }).safeParse(await request.json());
    if (!body.success) return badRequest("Invalid employer action");
    await connectDB();
    const employer = await Employer.findById(employerId);
    if (!employer) return notFound("Employer not found");

    if (body.data.action === "impersonate") {
      if (employer.active === false || (employer.status && employer.status !== "active")) {
        return badRequest("Only active employer accounts can be impersonated");
      }
      const token = await createSessionToken({
        employerId: employer._id.toString(),
        email: employer.email,
        companyName: employer.companyName,
      });
      const response = NextResponse.json({ success: true, redirectTo: "/workspace" });
      setSessionCookie(response, token);
      await recordAdminAction(session, "Started support impersonation", "employer", employer.companyName, employerId);
      return response;
    }

    const temporaryPassword = randomBytes(18).toString("base64url");
    employer.passwordHash = await hashPassword(temporaryPassword);
    await employer.save();
    await recordAdminAction(session, "Reset employer password", "employer", employer.companyName, employerId);
    return NextResponse.json({ temporaryPassword });
  } catch (error) {
    console.error("Admin employer action error:", error);
    return serverError();
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { session, error } = await requireAdminSession();
    if (error || !session) return error!;
    const { employerId } = await params;
    if (!mongoose.Types.ObjectId.isValid(employerId)) return badRequest("Invalid employer id");
    await connectDB();
    const employer = await Employer.findById(employerId).select("companyName");
    if (!employer) return notFound("Employer not found");

    const jobs = await Job.find({ employerId }).select("_id").lean();
    const jobIds = jobs.map((job) => job._id);
    const applications = await Application.find({ employerId }).select("_id").lean();
    const applicationIds = applications.map((application) => application._id);
    await recordAdminAction(session, "Deleted employer account", "employer", employer.companyName, employerId);
    await Promise.all([
      MatchResult.deleteMany({ $or: [{ employerId }, { jobId: { $in: jobIds } }, { applicationId: { $in: applicationIds } }] }),
      Application.deleteMany({ employerId }),
      Job.deleteMany({ employerId }),
      JobPostingPayment.deleteMany({ employerId }),
    ]);
    await Employer.findByIdAndDelete(employerId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin employer deletion error:", error);
    return serverError();
  }
}
