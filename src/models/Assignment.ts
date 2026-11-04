import mongoose, { Schema, models, model } from "mongoose";
import type { AssignmentTemplate } from "@/types";

export type AssignmentStatus =
  | "sent"
  | "in_progress"
  | "submitted"
  | "reviewed"
  | "expired";

export interface IAssignment {
  _id: mongoose.Types.ObjectId;
  applicationId: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  employerId: mongoose.Types.ObjectId;
  candidateName: string;
  candidateEmail: string;
  tokenHash: string;
  template: AssignmentTemplate;
  status: AssignmentStatus;
  assignedAt: Date;
  invitationExpiresAt: Date;
  startedAt?: Date;
  deadline?: Date;
  answers: Array<{ questionId: string; answer: string }>;
  files: Array<{
    questionId: string;
    fileName: string;
    mimeType: string;
    data: Buffer;
  }>;
  rating?: number;
  decision?: "pass" | "fail";
  feedback?: string;
  submittedAt?: Date;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AssignmentAnswerSchema = new Schema(
  {
    questionId: { type: String, required: true },
    answer: { type: String, required: true, maxlength: 10000 },
  },
  { _id: false },
);

const AssignmentFileSchema = new Schema(
  {
    questionId: { type: String, required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    data: { type: Buffer, required: true },
  },
  { _id: false },
);

const AssignmentSchema = new Schema<IAssignment>(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "Application",
      required: true,
      unique: true,
      index: true,
    },
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
    candidateName: { type: String, required: true },
    candidateEmail: { type: String, required: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    template: {
      type: new Schema(
        {
          instructions: { type: String, default: "" },
          timeLimitHours: { type: Number },
          questions: { type: [Schema.Types.Mixed], required: true },
        },
        { _id: false },
      ),
      required: true,
    },
    status: {
      type: String,
      enum: ["sent", "in_progress", "submitted", "reviewed", "expired"],
      default: "sent",
      index: true,
    },
    assignedAt: { type: Date, required: true },
    invitationExpiresAt: { type: Date, required: true },
    startedAt: { type: Date },
    deadline: { type: Date },
    answers: { type: [AssignmentAnswerSchema], default: [] },
    files: { type: [AssignmentFileSchema], default: [] },
    rating: { type: Number, min: 1, max: 5 },
    decision: { type: String, enum: ["pass", "fail"] },
    feedback: { type: String, maxlength: 2000 },
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
  },
  { timestamps: true },
);

export const Assignment =
  models.Assignment || model<IAssignment>("Assignment", AssignmentSchema);
