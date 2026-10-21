import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { badRequest, notFound, requireAdminSession, serverError } from "@/lib/auth";
import { Employer } from "@/models/Employer";

const updateSchema = z
  .object({
    active: z.boolean().optional(),
    jobPostingDiscountPercent: z.number().int().min(0).max(100).optional(),
  })
  .refine(
    (value) =>
      value.active !== undefined ||
      value.jobPostingDiscountPercent !== undefined,
    "Provide an account status or discount",
  );
type Params = { params: Promise<{ employerId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;
    const { employerId } = await params;
    if (!mongoose.Types.ObjectId.isValid(employerId)) return badRequest("Invalid employer id");
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || "Invalid employer update");
    await connectDB();
    const employer = await Employer.findByIdAndUpdate(employerId, parsed.data, { new: true })
      .select("email companyName active jobPostingDiscountPercent");
    if (!employer) return notFound("Employer not found");
    return NextResponse.json({ employer: {
      id: String(employer._id), email: employer.email, companyName: employer.companyName,
      active: employer.active, jobPostingDiscountPercent: employer.jobPostingDiscountPercent ?? 0,
    } });
  } catch (error) {
    console.error("Admin employer update error:", error);
    return serverError();
  }
}
