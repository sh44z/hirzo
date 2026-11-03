import { PlatformSettings, type IPlatformSettings } from "@/models/PlatformSettings";

export const DEFAULT_JOB_EXPIRATION_DAYS = 30;

export async function getPlatformSettings() {
  const settings = await PlatformSettings.findOne().lean<IPlatformSettings>();
  return {
    defaultJobExpirationDays:
      settings?.defaultJobExpirationDays ?? DEFAULT_JOB_EXPIRATION_DAYS,
    maintenanceMode: settings?.maintenanceMode ?? false,
    notificationTemplates: settings?.notificationTemplates ?? [],
  };
}

export async function getMaintenanceResponse() {
  const { maintenanceMode } = await getPlatformSettings();
  return maintenanceMode
    ? Response.json(
        { error: "Hirzo is temporarily unavailable for maintenance." },
        { status: 503 },
      )
    : null;
}
