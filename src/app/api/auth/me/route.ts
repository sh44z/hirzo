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

    if (!employer || employer.active === false) {
      return unauthorized();
    }

    return Response.json({
      employer: {
        id: employer._id.toString(),
        email: employer.email,
        companyName: employer.companyName,
        contactName: employer.contactName,
        jobPostingDiscountPercent: employer.jobPostingDiscountPercent ?? 0,
      },
    });
  } catch (error) {
    console.error("Me error:", error);
    return serverError();
  }
}
