import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { badRequest, notFound, serverError } from "@/lib/auth";
import { createApplicationSchema } from "@/lib/validations";
import { Job } from "@/models/Job";
import { Application } from "@/models/Application";
import { Employer } from "@/models/Employer";
import { MatchResult } from "@/models/MatchResult";
import { calculateMatchScore, extractCandidateProfile } from "@/lib/job-matching";
import type { CandidateProfile } from "@/types";

export const runtime = "nodejs";

/**
 * Public apply endpoint (no candidate account required).
 * Employers review these via /api/employers/applications/*
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    let uploadedCv:
      | {
          fileName: string;
          mimeType: string;
          data: Buffer;
          profile: CandidateProfile;
        }
      | undefined;

    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      let qualificationAnswers: unknown;
      let videoAnswers: unknown;
      try {
        qualificationAnswers = JSON.parse(
          String(form.get("qualificationAnswers") || "[]"),
        );
        videoAnswers = JSON.parse(String(form.get("videoAnswers") || "[]"));
      } catch {
        return badRequest("Invalid application answers");
      }

      const cvFile = form.get("cvFile");
      if (cvFile !== null) {
        if (!(cvFile instanceof File)) {
          return badRequest("Invalid CV file");
        }
        if (cvFile.size === 0 || cvFile.size > 4 * 1024 * 1024) {
          return badRequest("CV must be a non-empty file no larger than 4 MB");
        }
        const extension = cvFile.name.split(".").pop()?.toLowerCase();
        if (extension !== "doc" && extension !== "docx") {
          return badRequest("CV must be a Word document (.doc or .docx)");
        }
        const data = Buffer.from(await cvFile.arrayBuffer());
        const isDocx = extension === "docx";
        const isValidWordFile = isDocx
          ? data[0] === 0x50 && data[1] === 0x4b
          : data.subarray(0, 8).equals(
              Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
            );
        if (!isValidWordFile) {
          return badRequest("The uploaded file is not a valid Word document");
        }
        let profile: CandidateProfile;
        try {
          profile = await extractCandidateProfile(data);
        } catch (error) {
          console.warn("CV text extraction failed:", error);
          return badRequest("Could not read the uploaded CV. Please try another .docx file.");
        }
        const fileName = cvFile.name
          .split(/[\\/]/)
          .pop()!
          .replace(/[\u0000-\u001f\u007f]/g, "")
          .slice(0, 255);
        uploadedCv = {
          fileName,
            mimeType: isDocx
              ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              : "application/msword",
          data,
          profile,
        };
      }

      body = {
        jobId: form.get("jobId"),
        candidateName: form.get("candidateName"),
        candidateEmail: form.get("candidateEmail"),
        candidatePhone: form.get("candidatePhone") || undefined,
        cvUrl: form.get("cvUrl") || undefined,
        qualificationAnswers,
        videoAnswers,
      };
    } else {
      body = await request.json();
    }
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

    const candidateProfile = uploadedCv?.profile || {
      skills: [],
      yearsExperience: null,
      qualifications: [],
      responsibilities: [],
      otherRequirements: [],
    };
    const match = job.postingPlan === "premium"
      ? calculateMatchScore(job.requirements, candidateProfile)
      : null;

    try {
      const application = await Application.create({
        jobId: job._id,
        employerId: job.employerId,
        candidateName: parsed.data.candidateName,
        candidateEmail: parsed.data.candidateEmail.toLowerCase(),
        candidatePhone: parsed.data.candidatePhone,
        cvUrl: parsed.data.cvUrl,
        cvFileName: uploadedCv?.fileName || parsed.data.cvFileName,
        cvMimeType: uploadedCv?.mimeType,
        cvFileData: uploadedCv?.data,
        candidateProfile: uploadedCv?.profile,
        qualificationAnswers: parsed.data.qualificationAnswers,
        videoAnswers: parsed.data.videoAnswers,
        status: "applied",
      });

      if (match !== null) {
        try {
          await MatchResult.findOneAndUpdate(
            { applicationId: application._id },
            {
              jobId: job._id,
              employerId: job.employerId,
              score: match,
            },
            { upsert: true, new: true, setDefaultsOnInsert: true },
          );
        } catch (error) {
          await Application.deleteOne({ _id: application._id });
          throw error;
        }
      }

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
