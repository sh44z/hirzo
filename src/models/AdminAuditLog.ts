import mongoose, { Schema, models, model } from "mongoose";

export interface IAdminAuditLog {
  _id: mongoose.Types.ObjectId;
  adminId: mongoose.Types.ObjectId;
  adminName: string;
  action: string;
  targetType: "employer" | "job" | "candidate" | "settings" | "admin";
  targetId?: string;
  targetLabel: string;
  detail?: string;
  createdAt: Date;
}

const AdminAuditLogSchema = new Schema<IAdminAuditLog>(
  {
    adminId: { type: Schema.Types.ObjectId, required: true, index: true },
    adminName: { type: String, required: true },
    action: { type: String, required: true },
    targetType: {
      type: String,
      enum: ["employer", "job", "candidate", "settings", "admin"],
      required: true,
      index: true,
    },
    targetId: { type: String, index: true },
    targetLabel: { type: String, required: true },
    detail: { type: String, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const AdminAuditLog =
  models.AdminAuditLog ||
  model<IAdminAuditLog>("AdminAuditLog", AdminAuditLogSchema);
