"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("ZION recovered from an interface error", error);
    void (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      await supabase.from("zion_error_logs").insert({
        user_id: data.user.id,
        error_code: error.digest ? `REACT_${error.digest.slice(0, 60)}` : "CLIENT_BOUNDARY",
        route: window.location.pathname.slice(0, 200),
      });
    })();
  }, [error]);

  return (
    <main className="error-recovery">
      <section>
        <span aria-hidden>♥</span>
        <p>ZION</p>
        <h1>Connection interrupted</h1>
        <p>Your account and messages are safe. Please reconnect.</p>
        <button type="button" onClick={reset}>Try again</button>
        <button type="button" className="secondary" onClick={() => window.location.assign("/")}>Go home</button>
      </section>
    </main>
  );
}
