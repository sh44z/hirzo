import mongoose, { Schema, models, model } from "mongoose";

export interface ICandidatePolicy {
  _id: mongoose.Types.ObjectId;
  email: string;
  status: "active" | "flagged" | "banned";
  createdAt: Date;
  updatedAt: Date;
}

const CandidatePolicySchema = new Schema<ICandidatePolicy>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    status: { type: String, enum: ["active", "flagged", "banned"], default: "active", index: true },
  },
  { timestamps: true },
);

export const CandidatePolicy =
  models.CandidatePolicy ||
  model<ICandidatePolicy>("CandidatePolicy", CandidatePolicySchema);
