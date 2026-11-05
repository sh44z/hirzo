import mongoose, { Schema, models, model } from "mongoose";

export interface IInterviewVideoChunk {
  _id: mongoose.Types.ObjectId;
  applicationId: mongoose.Types.ObjectId;
  questionId: string;
  uploadId: string;
  chunkIndex: number;
  totalChunks: number;
  mimeType: string;
  data: Buffer;
  expiresAt: Date;
}

const InterviewVideoChunkSchema = new Schema<IInterviewVideoChunk>(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "Application",
      required: true,
    },
    questionId: { type: String, required: true },
    uploadId: { type: String, required: true },
    chunkIndex: { type: Number, required: true, min: 0 },
    totalChunks: { type: Number, required: true, min: 1, max: 10 },
    mimeType: {
      type: String,
      required: true,
      enum: ["video/webm", "video/mp4"],
    },
    data: { type: Buffer, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

InterviewVideoChunkSchema.index(
  { applicationId: 1, questionId: 1, uploadId: 1, chunkIndex: 1 },
  { unique: true },
);
InterviewVideoChunkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const InterviewVideoChunk =
  models.InterviewVideoChunk ||
  model<IInterviewVideoChunk>("InterviewVideoChunk", InterviewVideoChunkSchema);
