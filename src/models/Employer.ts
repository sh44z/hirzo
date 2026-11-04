import mongoose, { Schema, models, model } from "mongoose";
import type { JobPostingCredits } from "@/lib/job-posting-plans";

export interface IEmployer {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash: string;
  companyName: string;
  companyLogo?: string;
  companyDescription?: string;
  companyCulture?: string;
  companyBenefits?: string[];
  contactName: string;
  active: boolean;
  status: "active" | "paused" | "pending_verification" | "suspended" | "banned";
  jobPostingCredits: JobPostingCredits;
  createdAt: Date;
  updatedAt: Date;
}

const EmployerSchema = new Schema<IEmployer>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    companyName: { type: String, required: true, trim: true },
    companyLogo: { type: String },
    companyDescription: { type: String, trim: true, maxlength: 2000 },
    companyCulture: { type: String, trim: true, maxlength: 2000 },
    companyBenefits: { type: [String], default: [] },
    contactName: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["active", "paused", "pending_verification", "suspended", "banned"],
      default: "active",
      index: true,
    },
    jobPostingCredits: {
      basic: { type: Number, min: 0, default: 0 },
      premium: { type: Number, min: 0, default: 0 },
    },
  },
  { timestamps: true },
);

export const Employer =
  models.Employer || model<IEmployer>("Employer", EmployerSchema);
