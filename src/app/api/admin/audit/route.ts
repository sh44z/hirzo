import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdminSession, serverError } from "@/lib/auth";
import { AdminAuditLog } from "@/models/AdminAuditLog";

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;
    await connectDB();
    const targetId = request.nextUrl.searchParams.get("targetId");
    const logs = await AdminAuditLog.find(targetId ? { targetId } : {})
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    return NextResponse.json({
      logs: logs.map((log) => ({
        id: String(log._id),
        adminName: log.adminName,
        action: log.action,
        targetType: log.targetType,
        targetLabel: log.targetLabel,
        targetId: log.targetId,
        detail: log.detail || "",
        createdAt: log.createdAt,
      })),
    });
  } catch (error) {
    console.error("Admin audit log error:", error);
    return serverError();
  }
}
