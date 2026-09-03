"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("ZION recovered from an interface error", error);
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
