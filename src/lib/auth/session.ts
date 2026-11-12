import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import {
  createAdmin,
  findAdminByEmail,
  getAdmin,
  type AdminUser,
} from "@/lib/db/local";

const COOKIE_NAME = "attendance_admin_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days

function secret() {
  return (
    process.env.SESSION_SECRET ||
    process.env.KIOSK_SECRET ||
    "local-dev-session-secret-change-me"
  );
}

function timingSafeEqualStr(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

async function sign(payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  const bytes = new Uint8Array(sig);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function encodeSession(adminId: string) {
  const exp = Date.now() + MAX_AGE_SECONDS * 1000;
  const body = `${adminId}.${exp}`;
  return `${body}.${await sign(body)}`;
}

async function decodeSession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [adminId, expStr, sig] = parts as [string, string, string];
  const body = `${adminId}.${expStr}`;
  const expected = await sign(body);
  if (!timingSafeEqualStr(sig, expected)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  return adminId;
}

export async function getSessionAdmin(): Promise<AdminUser | null> {
  const jar = await cookies();
  const adminId = await decodeSession(jar.get(COOKIE_NAME)?.value);
  if (!adminId) return null;
  return getAdmin(adminId);
}

export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getSessionAdmin();
  if (!admin) {
    throw new AuthError("Unauthorized");
  }
  return admin;
}

export class AuthError extends Error {
  status = 401;
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export async function setSessionCookie(adminId: string) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, await encodeSession(adminId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function registerAdmin(input: {
  email: string;
  password: string;
  full_name?: string;
}) {
  const password_hash = await bcrypt.hash(input.password, 10);
  return createAdmin({
    email: input.email,
    password_hash,
    full_name: input.full_name || input.email.split("@")[0] || "Admin",
  });
}

export async function loginAdmin(email: string, password: string) {
  const admin = findAdminByEmail(email);
  if (!admin) return null;
  const ok = await bcrypt.compare(password, admin.password_hash);
  if (!ok) return null;
  return admin;
}
