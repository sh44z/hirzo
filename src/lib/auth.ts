import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { AdminAccount } from "@/models/AdminAccount";
import { Employer } from "@/models/Employer";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "hirzo_employer_session";

function getSecret() {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    throw new Error("Missing JWT_SECRET environment variable");
  }
  return new TextEncoder().encode(JWT_SECRET);
}

export interface EmployerSession {
  employerId: string;
  email: string;
  companyName: string;
}

export interface AdminSession {
  adminId: string;
  email: string;
  name: string;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(payload: EmployerSession) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, getSecret());
  return {
    employerId: String(payload.employerId),
    email: String(payload.email),
    companyName: String(payload.companyName),
  } satisfies EmployerSession;
}

export async function createAdminToken(payload: AdminSession) {
  return new SignJWT({ ...payload, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyAdminToken(token: string): Promise<AdminSession> {
  const { payload } = await jwtVerify(token, getSecret());
  if (payload.role !== "admin") throw new Error("Invalid admin session");
  return {
    adminId: String(payload.adminId),
    email: String(payload.email),
    name: String(payload.name),
  };
}

const ADMIN_COOKIE_NAME = "hirzo_admin_session";

export function setAdminCookie(response: NextResponse, token: string) {
  response.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearAdminCookie(response: NextResponse) {
  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return await verifyAdminToken(token);
  } catch {
    return null;
  }
}

export async function requireAdminSession() {
  const session = await getAdminSession();
  if (!session) {
    return { session: null as AdminSession | null, error: unauthorized() };
  }
  await connectDB();
  const account = (await AdminAccount.findById(session.adminId).select("active").lean()) as { active: boolean } | null;
  if (!account || !account.active) {
    return { session: null as AdminSession | null, error: unauthorized() };
  }
  return { session, error: null };
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionFromCookies(): Promise<EmployerSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(
  request: NextRequest,
): Promise<EmployerSession | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function requireEmployerSession() {
  const session = await getSessionFromCookies();
  if (!session) {
    return { session: null as EmployerSession | null, error: unauthorized() };
  }
  await connectDB();
  const employer = (await Employer.findById(session.employerId).select("active").lean()) as { active?: boolean } | null;
  if (!employer || employer.active === false) {
    return { session: null as EmployerSession | null, error: unauthorized("Employer account is inactive") };
  }
  return { session, error: null };
}

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(message = "Internal server error") {
  return NextResponse.json({ error: message }, { status: 500 });
}
