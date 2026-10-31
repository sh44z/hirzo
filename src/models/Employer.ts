import mongoose, { Schema, models, model } from "mongoose";

export interface IEmployer {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash: string;
  companyName: string;
  companyLogo?: string;
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
    contactName: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
    jobPostingDiscountPercent: { type: Number, min: 0, max: 100, default: 0 },
  },
  { timestamps: true },
);

export const Employer =
  models.Employer || model<IEmployer>("Employer", EmployerSchema);
