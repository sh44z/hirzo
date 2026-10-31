import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import {
  createSessionToken,
  verifyPassword,
  setSessionCookie,
  badRequest,
  unauthorized,
  serverError,
} from "@/lib/auth";
import { loginSchema } from "@/lib/validations";
import { Employer } from "@/models/Employer";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message || "Invalid input");
    }

    await connectDB();

    const employer = await Employer.findOne({
      email: parsed.data.email.toLowerCase(),
    });

    if (!employer || employer.active === false) {
      return unauthorized("Invalid email or password");
    }

    const valid = await verifyPassword(
      parsed.data.password,
      employer.passwordHash,
    );

    if (!valid) {
      return unauthorized("Invalid email or password");
    }

    const token = await createSessionToken({
      employerId: employer._id.toString(),
      email: employer.email,
      companyName: employer.companyName,
    });

    const response = NextResponse.json({
      employer: {
        id: employer._id.toString(),
        email: employer.email,
        companyName: employer.companyName,
        companyLogo: employer.companyLogo
          ? `/api/employers/${employer._id.toString()}/logo`
          : undefined,
        contactName: employer.contactName,
      },
    });

    setSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return serverError();
  }
}
