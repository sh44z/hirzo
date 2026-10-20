import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { badRequest, hashPassword, requireAdminSession, serverError } from "@/lib/auth";
import { AdminAccount } from "@/models/AdminAccount";

const createSchema = z.object({
  email: z.string().email(), name: z.string().min(2).max(120),
  password: z.string().min(12, "Master account passwords must be at least 12 characters"),
});

export async function GET() {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;
    await connectDB();
    const accounts = await AdminAccount.find().select("email name active createdAt").sort({ createdAt: 1 }).lean();
    return NextResponse.json({ accounts: accounts.map((account) => ({
      id: String(account._id), email: account.email, name: account.name,
      active: account.active, createdAt: account.createdAt,
    })) });
  } catch (error) {
    console.error("Admin accounts error:", error);
    return serverError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || "Invalid input");
    await connectDB();
    const email = parsed.data.email.toLowerCase();
    if (await AdminAccount.exists({ email })) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    let account;
    try {
      account = await AdminAccount.create({ email, name: parsed.data.name, passwordHash: await hashPassword(parsed.data.password) });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && (error as { code: number }).code === 11000) {
        return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ account: { id: String(account._id), email: account.email, name: account.name, active: account.active } }, { status: 201 });
  } catch (error) {
    console.error("Create admin account error:", error);
    return serverError();
  }
}
