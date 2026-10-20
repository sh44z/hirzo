import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";

export async function GET() {
  const { session, error } = await requireAdminSession();
  if (error || !session) return error!;
  return NextResponse.json({ admin: session });
}
