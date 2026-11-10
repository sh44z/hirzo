import mongoose, { Schema, models, model } from "mongoose";
import type {
  ApplicationStatus,
  QualificationAnswer,
  VideoAnswer,
  CandidateProfile,
  VirtualInterviewQuestion,
  VirtualInterviewAnswer,
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
  cvMimeType?: string;
  cvFileData?: Buffer;
  candidateProfile?: CandidateProfile;
  qualificationAnswers: QualificationAnswer[];
  videoAnswers: VideoAnswer[];
  status: ApplicationStatus;
  interviewToken?: string;
  interviewTokenExpiresAt?: Date;
  virtualInterviewTokenHash?: string;
  virtualInterviewTokenExpiresAt?: Date;
  virtualInterviewQuestions: VirtualInterviewQuestion[];
  virtualInterviewAnswers: VirtualInterviewAnswer[];
  virtualInterviewSubmittedAt?: Date;
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

const VirtualInterviewQuestionSchema = new Schema(
  {
    id: { type: String, required: true },
    question: { type: String, required: true },
    maxDurationSeconds: { type: Number, required: true },
    required: { type: Boolean, required: true },
  },
  { _id: false },
);

const VirtualInterviewAnswerSchema = new Schema(
  {
    questionId: { type: String, required: true },
    fileId: { type: String, required: true },
    mimeType: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    rating: { type: Number, min: 1, max: 5 },
  },
  { _id: false },
);

const CandidateProfileSchema = new Schema(
  {
    skills: { type: [String], default: [] },
    yearsExperience: { type: Number, min: 0, default: null },
    qualifications: { type: [String], default: [] },
    responsibilities: { type: [String], default: [] },
    otherRequirements: { type: [String], default: [] },
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
    cvMimeType: { type: String },
    cvFileData: { type: Buffer },
    candidateProfile: { type: CandidateProfileSchema },
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
      enum: [
        "applied",
        "shortlisted",
        "interview",
        "offer_extended",
        "hired",
        "rejected",
      ],
      default: "applied",
      index: true,
    },
    interviewToken: { type: String, index: true, sparse: true },
    interviewTokenExpiresAt: { type: Date },
    virtualInterviewTokenHash: { type: String, index: true, sparse: true },
    virtualInterviewTokenExpiresAt: { type: Date },
    virtualInterviewQuestions: {
      type: [VirtualInterviewQuestionSchema],
      default: [],
    },
    virtualInterviewAnswers: {
      type: [VirtualInterviewAnswerSchema],
      default: [],
    },
    virtualInterviewSubmittedAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: true },
);

ApplicationSchema.index({ jobId: 1, candidateEmail: 1 }, { unique: true });

export const Application =
  models.Application || model<IApplication>("Application", ApplicationSchema);
