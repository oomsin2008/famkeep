import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { provisionCurrentLineProfile } from "@/lib/auth/line-profile-provisioning";

interface SafeOauthDiagnostics {
  codePresent: "yes" | "no";
  error?: string;
  errorCode?: string;
  errorDescription?: string;
}

function getRedirectOrigin(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (process.env.NODE_ENV !== "development" && forwardedHost) {
    const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
    return `${forwardedProto}://${forwardedHost}`;
  }

  return requestUrl.origin;
}

function redirectNoStore(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Expires", "0");
  response.headers.set("Pragma", "no-cache");
  return response;
}

function getSafeParam(searchParams: URLSearchParams, name: string) {
  const value = searchParams.get(name);

  if (!value) {
    return undefined;
  }

  return value.replace(/[\r\n]/g, " ").slice(0, 500);
}

function getSafeOauthDiagnostics(
  searchParams: URLSearchParams,
): SafeOauthDiagnostics {
  return {
    codePresent: searchParams.has("code") ? "yes" : "no",
    error: getSafeParam(searchParams, "error"),
    errorCode: getSafeParam(searchParams, "error_code"),
    errorDescription: getSafeParam(searchParams, "error_description"),
  };
}

function redirectToAuthError(
  request: NextRequest,
  reason: string,
  diagnostics: SafeOauthDiagnostics,
) {
  const url = new URL("/auth/auth-code-error", getRedirectOrigin(request));
  url.searchParams.set("reason", reason);
  url.searchParams.set("code_present", diagnostics.codePresent);

  if (diagnostics.error) {
    url.searchParams.set("error", diagnostics.error);
  }

  if (diagnostics.errorCode) {
    url.searchParams.set("error_code", diagnostics.errorCode);
  }

  if (diagnostics.errorDescription) {
    url.searchParams.set("error_description", diagnostics.errorDescription);
  }

  return redirectNoStore(url);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const diagnostics = getSafeOauthDiagnostics(requestUrl.searchParams);

  if (!isSupabaseConfigured()) {
    return redirectToAuthError(request, "missing_supabase_config", diagnostics);
  }

  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return redirectToAuthError(request, "missing_code", diagnostics);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth
    .exchangeCodeForSession(code)
    .catch(() => ({ error: new Error("Auth code exchange failed") }));

  if (error) {
    return redirectToAuthError(request, "exchange_failed", diagnostics);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser().catch(() => ({
    data: { user: null },
    error: new Error("Authenticated user lookup failed"),
  }));

  if (user && !userError) {
    await provisionCurrentLineProfile(supabase, user);
  }

  return redirectNoStore(new URL("/", getRedirectOrigin(request)));
}
