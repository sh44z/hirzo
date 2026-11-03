import mongoose from "mongoose";
import type { AdminSession } from "@/lib/auth";
import { AdminAuditLog } from "@/models/AdminAuditLog";

type AuditTarget = "employer" | "job" | "candidate" | "settings" | "admin";

export function recordAdminAction(
  admin: AdminSession,
  action: string,
  targetType: AuditTarget,
  targetLabel: string,
  targetId?: string,
  detail?: string,
) {
  return AdminAuditLog.create({
    adminId: new mongoose.Types.ObjectId(admin.adminId),
    adminName: admin.name,
    action,
    targetType,
    targetLabel,
    targetId,
    detail,
  });
}
