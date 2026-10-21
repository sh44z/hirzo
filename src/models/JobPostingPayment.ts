import mongoose, { Schema, models, model } from "mongoose";
import type { JobPostingPlan } from "@/lib/job-posting-plans";

export interface IJobPostingPayment {
  _id: mongoose.Types.ObjectId;
  employerId: mongoose.Types.ObjectId;
  paypalOrderId?: string;
  plan: JobPostingPlan;
  amount: number;
  jobData: Record<string, unknown>;
  status: "creating" | "pending" | "captured" | "failed";
  jobId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const JobPostingPaymentSchema = new Schema<IJobPostingPayment>(
  {
    employerId: {
      type: Schema.Types.ObjectId,
      ref: "Employer",
      required: true,
      index: true,
    },
    paypalOrderId: { type: String, unique: true, sparse: true },
    plan: {
      type: String,
      enum: ["basic", "premium", "full_recruitment"],
      required: true,
    },
    amount: { type: Number, required: true },
    jobData: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["creating", "pending", "captured", "failed"],
      default: "creating",
      index: true,
    },
    jobId: { type: Schema.Types.ObjectId, ref: "Job" },
  },
  { timestamps: true },
);

export const JobPostingPayment =
  models.JobPostingPayment ||
  model<IJobPostingPayment>("JobPostingPayment", JobPostingPaymentSchema);
