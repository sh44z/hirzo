import { NextRequest, NextResponse } from "next/server";
import { requireEmployerSession, serverError } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { companyProfileSchema } from "@/lib/validations";
import { Employer } from "@/models/Employer";

export async function PATCH(request: NextRequest) {
  try {
    const { session, error } = await requireEmployerSession();
    if (error || !session) return error!;

    const parsed = companyProfileSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid company profile." },
        { status: 400 },
      );
    }

    await connectDB();
    const employer = await Employer.findById(session.employerId);
    if (!employer || employer.active === false) {
      return NextResponse.json({ error: "Employer account not found." }, { status: 404 });
    }
    if (parsed.data.companyDescription !== undefined) {
      employer.companyDescription = parsed.data.companyDescription;
    }
    if (parsed.data.companyCulture !== undefined) {
      employer.companyCulture = parsed.data.companyCulture;
    }
    if (parsed.data.companyBenefits !== undefined) {
      employer.companyBenefits = parsed.data.companyBenefits;
    }
    await employer.save();

    return NextResponse.json({
      profile: {
        companyDescription: employer.companyDescription || "",
        companyCulture: employer.companyCulture || "",
        companyBenefits: employer.companyBenefits || [],
      },
    });
  } catch (error) {
    console.error("Update company profile error:", error);
    return serverError();
  }
}
