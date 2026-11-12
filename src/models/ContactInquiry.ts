import mongoose, { Schema, model, models } from "mongoose";

export type ContactInquiryService = "full_recruitment" | "hiring_training";

export interface IContactInquiry {
  _id: mongoose.Types.ObjectId;
  name: string;
  companyName: string;
  email: string;
  phone: string;
  service: ContactInquiryService;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

const ContactInquirySchema = new Schema<IContactInquiry>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    companyName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 40, default: "" },
    service: {
      type: String,
      enum: ["full_recruitment", "hiring_training"],
      required: true,
    },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

export const ContactInquiry =
  models.ContactInquiry ||
  model<IContactInquiry>("ContactInquiry", ContactInquirySchema);
