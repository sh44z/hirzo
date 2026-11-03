import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { badRequest, requireAdminSession, serverError } from "@/lib/auth";
import { PlatformSettings } from "@/models/PlatformSettings";
import { recordAdminAction } from "@/lib/admin-audit";
import { getPlatformSettings } from "@/lib/platform-settings";

const updateSchema = z.object({
  defaultJobExpirationDays: z.number().int().min(1).max(365).optional(),
  maintenanceMode: z.boolean().optional(),
  notificationTemplates: z.array(z.object({
    key: z.string().trim().min(1).max(80),
    subject: z.string().trim().min(1).max(200),
    body: z.string().min(1).max(5000),
  })).max(20).optional(),
}).refine((value) => Object.keys(value).length > 0, "Provide at least one setting");

export async function GET() {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;
    await connectDB();
    return NextResponse.json({ settings: await getPlatformSettings() });
  } catch (error) {
    console.error("Admin settings error:", error);
    return serverError();
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { session, error } = await requireAdminSession();
    if (error || !session) return error!;
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || "Invalid settings");
    await connectDB();
    const settings = await PlatformSettings.findOneAndUpdate(
      {},
      { $set: parsed.data },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    const changed = Object.keys(parsed.data).join(", ");
    await recordAdminAction(session, "Updated platform settings", "settings", "Platform settings", undefined, changed);
    return NextResponse.json({ settings: {
      defaultJobExpirationDays: settings.defaultJobExpirationDays,
      maintenanceMode: settings.maintenanceMode,
      notificationTemplates: settings.notificationTemplates,
    } });
  } catch (error) {
    console.error("Update admin settings error:", error);
    return serverError();
  }
}
