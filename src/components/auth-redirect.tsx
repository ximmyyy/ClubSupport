"use client";

import { useEffect } from "react";

/**
 * Magic links fall back to the Site URL (the landing page) when the redirect URL is not
 * allow-listed in Supabase. Forward the login tokens to the app so the session is picked up.
 */
export function AuthRedirect() {
  useEffect(() => {
    const { hash, search } = window.location;
    if (/access_token=|error_description=/.test(hash) || /[?&](code|token_hash)=/.test(search)) {
      window.location.replace(`/app${search}${hash}`);
    }
  }, []);
  return null;
}
