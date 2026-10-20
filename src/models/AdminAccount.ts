import mongoose, { Schema, models, model } from "mongoose";

export interface IAdminAccount {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AdminAccountSchema = new Schema<IAdminAccount>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const AdminAccount =
  models.AdminAccount || model<IAdminAccount>("AdminAccount", AdminAccountSchema);
