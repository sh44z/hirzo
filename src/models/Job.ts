import mongoose, { Schema, models, model } from "mongoose";
import type {
  EmploymentType,
  JobStatus,
  QualificationQuestion,
  VideoQuestion,
} from "@/types";

export interface IJob {
  _id: mongoose.Types.ObjectId;
  employerId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  location: string;
  employmentType: EmploymentType;
  salaryMin?: number;
  salaryMax?: number;
  currency: string;
  status: JobStatus;
  qualificationQuestions: QualificationQuestion[];
  videoQuestions: VideoQuestion[];
  createdAt: Date;
  updatedAt: Date;
}

const QualificationQuestionSchema = new Schema(
  {
    id: { type: String, required: true },
    question: { type: String, required: true },
    type: {
      type: String,
      enum: ["text", "yes_no", "multiple_choice"],
      required: true,
    },
    options: [{ type: String }],
    required: { type: Boolean, default: true },
  },
  { _id: false },
);

const VideoQuestionSchema = new Schema(
  {
    id: { type: String, required: true },
    question: { type: String, required: true },
    maxDurationSeconds: { type: Number, default: 120 },
    required: { type: Boolean, default: true },
  },
  { _id: false },
);

const JobSchema = new Schema<IJob>(
  {
    employerId: {
      type: Schema.Types.ObjectId,
      ref: "Employer",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    location: { type: String, required: true, trim: true },
    employmentType: {
      type: String,
      enum: ["full_time", "part_time", "contract", "internship", "temporary"],
      required: true,
    },
    salaryMin: { type: Number },
    salaryMax: { type: Number },
    currency: { type: String, default: "GBP" },
    status: {
      type: String,
      enum: ["draft", "published", "closed"],
      default: "draft",
      index: true,
    },
    qualificationQuestions: {
      type: [QualificationQuestionSchema],
      default: [],
    },
    videoQuestions: {
      type: [VideoQuestionSchema],
      default: [],
    },
  },
  { timestamps: true },
);

export const Job = models.Job || model<IJob>("Job", JobSchema);
