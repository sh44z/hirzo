import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { badRequest, serverError } from "@/lib/auth";
import { contactInquirySchema } from "@/lib/validations";
import { ContactInquiry } from "@/models/ContactInquiry";

export async function POST(request: NextRequest) {
  try {
    const parsed = contactInquirySchema.safeParse(await request.json());
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message || "Invalid inquiry.");
    }

    await connectDB();
    const inquiry = await ContactInquiry.create(parsed.data);
    return NextResponse.json({ id: String(inquiry._id) }, { status: 201 });
  } catch (error) {
    console.error("Create contact inquiry error:", error);
    return serverError();
  }
}
