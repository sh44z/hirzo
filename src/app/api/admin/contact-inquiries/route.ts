import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdminSession, serverError } from "@/lib/auth";
import { ContactInquiry } from "@/models/ContactInquiry";

export async function GET() {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;

    await connectDB();
    const inquiries = await ContactInquiry.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return NextResponse.json({
      inquiries: inquiries.map((inquiry) => ({
        id: String(inquiry._id),
        name: inquiry.name,
        companyName: inquiry.companyName,
        email: inquiry.email,
        phone: inquiry.phone || "",
        service: inquiry.service,
        message: inquiry.message,
        createdAt: inquiry.createdAt,
      })),
    });
  } catch (error) {
    console.error("Admin contact inquiries error:", error);
    return serverError();
  }
}
