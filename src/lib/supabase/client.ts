"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";

export function createClient() {
  const config = getSupabaseConfig();

  if (!config) {
    throw new Error("Supabase public environment variables are not configured.");
  }

  return createBrowserClient(config.supabaseUrl, config.supabasePublishableKey);
}
