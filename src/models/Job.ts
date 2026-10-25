import mongoose, { Schema, models, model } from "mongoose";
import type {
  EmploymentType,
  JobStatus,
  QualificationQuestion,
  VideoQuestion,
  JobRequirements,
  MatchWeights,
} from "@/types";
import type { JobPostingPlan } from "@/lib/job-posting-plans";

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
  postingPlan: JobPostingPlan;
  postingPrice: number;
  featured: boolean;
  requirements: JobRequirements;
  matchWeights: MatchWeights;
  paymentId?: mongoose.Types.ObjectId;
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

const JobRequirementsSchema = new Schema(
  {
    skills: { type: [String], default: [] },
    yearsExperience: { type: Number, min: 0, default: 0 },
    qualifications: { type: [String], default: [] },
    responsibilities: { type: [String], default: [] },
    otherRequirements: { type: [String], default: [] },
  },
  { _id: false },
);

const MatchWeightsSchema = new Schema(
  {
    skills: { type: Number, min: 0, max: 100, default: 40 },
    experience: { type: Number, min: 0, max: 100, default: 30 },
    qualifications: { type: Number, min: 0, max: 100, default: 15 },
    other: { type: Number, min: 0, max: 100, default: 15 },
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
    postingPlan: {
      type: String,
      enum: ["basic", "premium", "full_recruitment"],
      required: true,
    },
    postingPrice: { type: Number, required: true },
    featured: { type: Boolean, default: false, index: true },
    requirements: { type: JobRequirementsSchema, default: () => ({}) },
    matchWeights: { type: MatchWeightsSchema, default: () => ({}) },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "JobPostingPayment",
      unique: true,
      sparse: true,
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
