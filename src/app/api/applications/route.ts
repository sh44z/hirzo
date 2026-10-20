import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { badRequest, notFound, serverError } from "@/lib/auth";
import { createApplicationSchema } from "@/lib/validations";
import { Job } from "@/models/Job";
import { Application } from "@/models/Application";
import { Employer } from "@/models/Employer";

/**
 * Public apply endpoint (no candidate account required).
 * Employers review these via /api/employers/applications/*
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createApplicationSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message || "Invalid input");
    }

    if (!mongoose.Types.ObjectId.isValid(parsed.data.jobId)) {
      return badRequest("Invalid job id");
    }

    await connectDB();

    const job = await Job.findById(parsed.data.jobId);
    if (!job || job.status !== "published") {
      return notFound("Job is not open for applications");
    }
    const employer = (await Employer.findById(job.employerId).select("active").lean()) as { active?: boolean } | null;
    if (!employer || employer.active === false) {
      return notFound("Job is not open for applications");
    }

    const requiredQual = job.qualificationQuestions.filter(
      (q: { required: boolean }) => q.required,
    );
    for (const question of requiredQual) {
      const answer = parsed.data.qualificationAnswers.find(
        (a) => a.questionId === question.id,
      );
      if (!answer?.answer?.trim()) {
        return badRequest(`Missing answer for: ${question.question}`);
      }
    }

    const requiredVideo = job.videoQuestions.filter(
      (q: { required: boolean }) => q.required,
    );
    for (const question of requiredVideo) {
      const answer = parsed.data.videoAnswers.find(
        (a) => a.questionId === question.id,
      );
      if (!answer?.videoUrl) {
        return badRequest(`Missing video answer for: ${question.question}`);
      }
    }

    try {
      const application = await Application.create({
        jobId: job._id,
        employerId: job.employerId,
        candidateName: parsed.data.candidateName,
        candidateEmail: parsed.data.candidateEmail.toLowerCase(),
        candidatePhone: parsed.data.candidatePhone,
        cvUrl: parsed.data.cvUrl,
        cvFileName: parsed.data.cvFileName,
        qualificationAnswers: parsed.data.qualificationAnswers,
        videoAnswers: parsed.data.videoAnswers,
        status: "applied",
      });

      return NextResponse.json(
        {
          application: {
            id: application._id.toString(),
            jobId: application.jobId.toString(),
            status: application.status,
            candidateEmail: application.candidateEmail,
          },
        },
        { status: 201 },
      );
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: number }).code === 11000
      ) {
        return NextResponse.json(
          { error: "You have already applied to this job" },
          { status: 409 },
        );
      }
      throw err;
    }
  } catch (error) {
    console.error("Create application error:", error);
    return serverError();
  }
}
