import mongoose, { Schema, models, model } from "mongoose";

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
  jobPostingDiscountPercent: number;
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
    jobPostingDiscountPercent: { type: Number, min: 0, max: 100, default: 0 },
  },
  { timestamps: true },
);

export const Employer =
  models.Employer || model<IEmployer>("Employer", EmployerSchema);
