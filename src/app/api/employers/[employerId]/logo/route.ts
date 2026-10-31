import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { badRequest, notFound, serverError } from "@/lib/auth";
import { Employer } from "@/models/Employer";

type Params = { params: Promise<{ employerId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { employerId } = await params;
    if (!mongoose.Types.ObjectId.isValid(employerId)) {
      return badRequest("Invalid employer id");
    }

    await connectDB();
    const employer = await Employer.findById(employerId)
      .select("companyLogo active")
      .exec();
    if (!employer || employer.active === false || !employer.companyLogo) {
      return notFound("Company logo not found");
    }

    const match = employer.companyLogo.match(
      /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/,
    );
    if (!match) {
      console.error("Stored company logo has an invalid image format:", employerId);
      return serverError();
    }

    return new NextResponse(Buffer.from(match[2], "base64"), {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Type": `image/${match[1]}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Company logo error:", error);
    return serverError();
  }
}
