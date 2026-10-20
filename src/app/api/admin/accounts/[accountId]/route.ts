import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { badRequest, notFound, requireAdminSession, serverError } from "@/lib/auth";
import { AdminAccount } from "@/models/AdminAccount";

const updateSchema = z.object({ active: z.boolean() });
type Params = { params: Promise<{ accountId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { session, error } = await requireAdminSession();
    if (error || !session) return error!;
    const { accountId } = await params;
    if (!mongoose.Types.ObjectId.isValid(accountId)) return badRequest("Invalid account id");
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest("Active must be true or false");
    if (accountId === session.adminId && !parsed.data.active) return badRequest("You cannot deactivate your own account");
    await connectDB();
    if (!parsed.data.active && await AdminAccount.countDocuments({ active: true }) <= 1) return badRequest("At least one master account must remain active");
    const account = await AdminAccount.findByIdAndUpdate(accountId, { active: parsed.data.active }, { new: true }).select("email name active");
    if (!account) return notFound("Account not found");
    return NextResponse.json({ account: { id: String(account._id), email: account.email, name: account.name, active: account.active } });
  } catch (error) {
    console.error("Admin account update error:", error);
    return serverError();
  }
}
