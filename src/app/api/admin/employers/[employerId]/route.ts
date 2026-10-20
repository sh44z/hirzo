import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { badRequest, notFound, requireAdminSession, serverError } from "@/lib/auth";
import { Employer } from "@/models/Employer";

const updateSchema = z.object({ active: z.boolean() });
type Params = { params: Promise<{ employerId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;
    const { employerId } = await params;
    if (!mongoose.Types.ObjectId.isValid(employerId)) return badRequest("Invalid employer id");
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest("Active must be true or false");
    await connectDB();
    const employer = await Employer.findByIdAndUpdate(employerId, { active: parsed.data.active }, { new: true })
      .select("email companyName active");
    if (!employer) return notFound("Employer not found");
    return NextResponse.json({ employer: { id: String(employer._id), email: employer.email, companyName: employer.companyName, active: employer.active } });
  } catch (error) {
    console.error("Admin employer update error:", error);
    return serverError();
  }
}
