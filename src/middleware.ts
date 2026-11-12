import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "attendance_admin_session";

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

async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [adminId, expStr, sig] = parts;
  const body = `${adminId}.${expStr}`;
  const expected = await sign(body);
  if (!timingSafeEqualStr(sig!, expected)) return false;
  const exp = Number(expStr);
  return Number.isFinite(exp) && Date.now() <= exp;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isLogin = path.startsWith("/admin/login");
  const isAdmin = path.startsWith("/admin") && !isLogin;
  const loggedIn = await isValidSession(
    request.cookies.get(COOKIE_NAME)?.value,
  );

  if (isAdmin && !loggedIn) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/admin/login";
    redirect.searchParams.set("next", path);
    return NextResponse.redirect(redirect);
  }

  if (isLogin && loggedIn) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/admin";
    return NextResponse.redirect(redirect);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
