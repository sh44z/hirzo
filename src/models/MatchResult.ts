import mongoose, { Schema, models, model } from "mongoose";

export interface IMatchResult {
  _id: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  applicationId: mongoose.Types.ObjectId;
  employerId: mongoose.Types.ObjectId;
  score: number;
  createdAt: Date;
  updatedAt: Date;
}

const MatchResultSchema = new Schema<IMatchResult>(
  {
    jobId: {
      type: Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "Application",
      required: true,
      unique: true,
    },
    employerId: {
      type: Schema.Types.ObjectId,
      ref: "Employer",
      required: true,
      index: true,
    },
    score: { type: Number, min: 0, max: 100, required: true, index: true },
  },
  { timestamps: true },
);

MatchResultSchema.index({ jobId: 1, score: -1, updatedAt: -1 });

export const MatchResult =
  models.MatchResult || model<IMatchResult>("MatchResult", MatchResultSchema);
