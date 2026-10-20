import mongoose, { Schema, models, model } from "mongoose";

export interface IEmployer {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash: string;
  companyName: string;
  contactName: string;
  active: boolean;
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
    contactName: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Employer =
  models.Employer || model<IEmployer>("Employer", EmployerSchema);
