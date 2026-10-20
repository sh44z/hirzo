import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import {
  createAdminToken,
  hashPassword,
  setAdminCookie,
  verifyPassword,
  badRequest,
  unauthorized,
  serverError,
} from "@/lib/auth";
import { AdminAccount } from "@/models/AdminAccount";

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const INITIAL_ADMIN_EMAIL = "admin@hirzo.com";

export async function POST(request: NextRequest) {
  try {
    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || "Invalid input");
    await connectDB();

    const email = parsed.data.email.toLowerCase();
    let account = await AdminAccount.findOne({ email });
    if (!account && email === INITIAL_ADMIN_EMAIL && process.env.ADMIN_INITIAL_PASSWORD) {
      account = await AdminAccount.create({
        email: INITIAL_ADMIN_EMAIL,
        name: "Hirzo Administrator",
        passwordHash: await hashPassword(process.env.ADMIN_INITIAL_PASSWORD),
      });
    }
    if (!account || !account.active || !(await verifyPassword(parsed.data.password, account.passwordHash))) {
      return unauthorized("Invalid email or password");
    }

    const token = await createAdminToken({
      adminId: account._id.toString(),
      email: account.email,
      name: account.name,
    });
    const response = NextResponse.json({ admin: { id: account._id.toString(), email: account.email, name: account.name } });
    setAdminCookie(response, token);
    return response;
  } catch (error) {
    console.error("Admin login error:", error);
    return serverError();
  }
}
