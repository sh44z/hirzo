import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import {
  requireEmployerSession,
  badRequest,
  serverError,
} from "@/lib/auth";
import { createJobSchema } from "@/lib/validations";
import {
  normalizeQualificationQuestions,
  normalizeVideoQuestions,
} from "@/lib/questions";
import { Job } from "@/models/Job";

export async function GET() {
  try {
    const { session, error } = await requireEmployerSession();
    if (error || !session) return error!;

    await connectDB();

    const jobs = await Job.find({ employerId: session.employerId })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      jobs: jobs.map((job) => ({
        ...job,
        id: job._id.toString(),
        employerId: job.employerId.toString(),
        _id: undefined,
      })),
    });
  } catch (error) {
    console.error("List jobs error:", error);
    return serverError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireEmployerSession();
    if (error || !session) return error!;

    const body = await request.json();
    const parsed = createJobSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message || "Invalid input");
    }

    if (
      parsed.data.salaryMin != null &&
      parsed.data.salaryMax != null &&
      parsed.data.salaryMin > parsed.data.salaryMax
    ) {
      return badRequest("salaryMin cannot be greater than salaryMax");
    }

    await connectDB();

    const job = await Job.create({
      employerId: session.employerId,
      title: parsed.data.title,
      description: parsed.data.description,
      location: parsed.data.location,
      employmentType: parsed.data.employmentType,
      salaryMin: parsed.data.salaryMin,
      salaryMax: parsed.data.salaryMax,
      currency: parsed.data.currency,
      status: parsed.data.status,
      qualificationQuestions: normalizeQualificationQuestions(
        parsed.data.qualificationQuestions,
      ),
      videoQuestions: normalizeVideoQuestions(parsed.data.videoQuestions),
    });

    return NextResponse.json(
      {
        job: {
          id: job._id.toString(),
          employerId: job.employerId.toString(),
          title: job.title,
          description: job.description,
          location: job.location,
          employmentType: job.employmentType,
          salaryMin: job.salaryMin,
          salaryMax: job.salaryMax,
          currency: job.currency,
          status: job.status,
          qualificationQuestions: job.qualificationQuestions,
          videoQuestions: job.videoQuestions,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create job error:", error);
    return serverError();
  }
}
