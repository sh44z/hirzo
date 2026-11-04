import { connectDB } from "@/lib/db";
import {
  getSessionFromCookies,
  unauthorized,
  serverError,
} from "@/lib/auth";
import { Employer } from "@/models/Employer";

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return unauthorized();
    }

    await connectDB();
    const employer = await Employer.findById(session.employerId).select(
      "-passwordHash",
    );

    if (!employer || employer.active === false || (employer.status && employer.status !== "active")) {
      return unauthorized();
    }

    return Response.json({
      employer: {
        id: employer._id.toString(),
        email: employer.email,
        companyName: employer.companyName,
        companyDescription: employer.companyDescription || "",
        companyCulture: employer.companyCulture || "",
        companyBenefits: employer.companyBenefits || [],
        companyLogo: employer.companyLogo
          ? `/api/employers/${employer._id.toString()}/logo`
          : undefined,
        contactName: employer.contactName,
        jobPostingCredits: {
          basic: employer.jobPostingCredits?.basic ?? 0,
          premium: employer.jobPostingCredits?.premium ?? 0,
        },
      },
    });
  } catch (error) {
    console.error("Me error:", error);
    return serverError();
  }
}
