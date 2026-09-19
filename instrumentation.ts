export async function register() {
  // Only in the real Node.js server runtime — this file also runs in
  // Next's edge runtime context during the build/type-check phase,
  // where starting a setInterval-based background job makes no sense
  // and DATABASE_URL likely isn't even available.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startNotificationScheduler } = await import("@/lib/notificationScheduler");
    startNotificationScheduler();
  }
}
