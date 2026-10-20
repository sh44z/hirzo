import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import {
  createSessionToken,
  hashPassword,
  setSessionCookie,
  assertSessionSecretConfigured,
  badRequest,
  serverError,
} from "@/lib/auth";
import { registerSchema } from "@/lib/validations";
import { Employer } from "@/models/Employer";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message || "Invalid input");
    }

    assertSessionSecretConfigured();
    await connectDB();

    const email = parsed.data.email.toLowerCase();
    const existing = await Employer.findOne({ email });
    if (existing) {
      return NextResponse.json(
        { error: "An employer with this email already exists" },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(parsed.data.password);
    let employer;
    try {
      employer = await Employer.create({
        email,
        passwordHash,
        companyName: parsed.data.companyName,
        contactName: parsed.data.contactName,
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && (error as { code: number }).code === 11000) {
        return NextResponse.json({ error: "An employer with this email already exists" }, { status: 409 });
      }
      throw error;
    }

    const token = await createSessionToken({
      employerId: employer._id.toString(),
      email: employer.email,
      companyName: employer.companyName,
    });

    const response = NextResponse.json(
      {
        employer: {
          id: employer._id.toString(),
          email: employer.email,
          companyName: employer.companyName,
          contactName: employer.contactName,
        },
      },
      { status: 201 },
    );

    setSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error("Register error:", error);
    return serverError();
  }
}
