/**
 * Startup hook. Next.js runs this once before serving requests.
 *
 * Configuration is validated here so a misconfigured production deployment
 * fails at boot rather than at the first customer message (doc 16 §2).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { assertConfig } = await import("@/lib/env");
  assertConfig();

  // Retries and funnel waits run on the app's own clock in production only,
  // so a local `npm run dev` against the real database never sends anything.
  if (process.env.NODE_ENV === "production") {
    const { startTickLoop } = await import("@/lib/tick");
    startTickLoop();
  }
}
