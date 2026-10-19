import mongoose, { Schema, models, model } from "mongoose";
import type {
  ApplicationStatus,
  QualificationAnswer,
  VideoAnswer,
} from "@/types";

export interface IApplication {
  _id: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  employerId: mongoose.Types.ObjectId;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  cvUrl?: string;
  cvFileName?: string;
  qualificationAnswers: QualificationAnswer[];
  videoAnswers: VideoAnswer[];
  status: ApplicationStatus;
  interviewToken?: string;
  interviewTokenExpiresAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const QualificationAnswerSchema = new Schema(
  {
    questionId: { type: String, required: true },
    answer: { type: String, required: true },
  },
  { _id: false },
);

const VideoAnswerSchema = new Schema(
  {
    questionId: { type: String, required: true },
    videoUrl: { type: String, required: true },
  },
  { _id: false },
);

const ApplicationSchema = new Schema<IApplication>(
  {
    jobId: {
      type: Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },
    employerId: {
      type: Schema.Types.ObjectId,
      ref: "Employer",
      required: true,
      index: true,
    },
    candidateName: { type: String, required: true, trim: true },
    candidateEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    candidatePhone: { type: String, trim: true },
    cvUrl: { type: String },
    cvFileName: { type: String },
    qualificationAnswers: {
      type: [QualificationAnswerSchema],
      default: [],
    },
    videoAnswers: {
      type: [VideoAnswerSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ["applied", "shortlisted", "interview", "hired", "rejected"],
      default: "applied",
      index: true,
    },
    interviewToken: { type: String, index: true, sparse: true },
    interviewTokenExpiresAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: true },
);

ApplicationSchema.index({ jobId: 1, candidateEmail: 1 }, { unique: true });

export const Application =
  models.Application || model<IApplication>("Application", ApplicationSchema);
