import { Schema, models, model } from "mongoose";

export interface INotificationTemplate {
  key: string;
  subject: string;
  body: string;
}

export interface IPlatformSettings {
  defaultJobExpirationDays: number;
  maintenanceMode: boolean;
  notificationTemplates: INotificationTemplate[];
  updatedAt: Date;
}

const NotificationTemplateSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    body: { type: String, required: true },
  },
  { _id: false },
);

const PlatformSettingsSchema = new Schema<IPlatformSettings>(
  {
    defaultJobExpirationDays: { type: Number, min: 1, max: 365, default: 30 },
    maintenanceMode: { type: Boolean, default: false },
    notificationTemplates: { type: [NotificationTemplateSchema], default: [] },
  },
  { timestamps: true },
);

export const PlatformSettings =
  models.PlatformSettings ||
  model<IPlatformSettings>("PlatformSettings", PlatformSettingsSchema);
