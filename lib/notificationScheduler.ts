import { runWatchlistNotificationCheck } from "@/lib/notifications";

// Every 30 minutes — frequent enough that a tier/score change is
// reflected in someone's inbox the same day it happens, not so
// frequent that it's meaningfully hammering the DB or Resend for a
// signal (score/tier movement) that itself only updates on the
// sheet's own ~60s cache cycle at most, and realistically far less
// often than that in practice.
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

let started = false;

/**
 * Railway hosts this as a single always-on Node process, not
 * serverless functions — there's no existing cron/scheduled-job
 * infrastructure in this codebase to plug into (checked: no cron
 * config, no job queue, no external scheduler). An in-process
 * interval is the correct, pragmatic choice for this deployment
 * shape rather than standing up new infrastructure for one feature.
 *
 * Guarded by the module-level `started` flag so this only ever
 * registers one interval per process, regardless of how many times
 * this module gets imported (Node's module cache means the import
 * itself only truly re-executes once, but the guard makes that
 * invariant explicit rather than implicit).
 */
export function startNotificationScheduler() {
  if (started) return;
  started = true;

  const runCheck = async () => {
    try {
      const result = await runWatchlistNotificationCheck();
      if (result.changesDetected > 0) {
        console.log(
          `[notifications] Checked watchlists: ${result.changesDetected} change(s) detected, ${result.usersNotified} user(s) notified.`
        );
      }
    } catch (err) {
      console.error("[notifications] Scheduled check failed:", err);
    }
  };

  // Runs once shortly after the process starts (not immediately —
  // gives the process a moment to finish booting before its first DB
  // work), then on the fixed interval after that.
  setTimeout(runCheck, 30_000);
  setInterval(runCheck, CHECK_INTERVAL_MS);
}
