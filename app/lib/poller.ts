import { Blog } from "../models/Blog.ts";
import { query } from "./db.ts";
import { fetchAndIngestBlog } from "./feedFetch.ts";

const CONCURRENCY = 10;
const STALE_HOURS = 1;
const TICK_INTERVAL_MS = 5 * 60 * 1000;

const runWithConcurrency = async <T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<unknown>,
): Promise<void> => {
  let cursor = 0;
  const next = async (): Promise<void> => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        await worker(items[i]);
      } catch (e) {
        console.error("[poller] worker error:", e);
      }
    }
  };
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => next(),
  );
  await Promise.all(workers);
};

const pingHealthcheck = async (): Promise<void> => {
  const url = Deno.env.get("HEALTHCHECK_PING_URL");
  if (!url) return;
  try {
    await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(5_000),
    });
  } catch (e) {
    console.error("[poller] healthcheck ping failed:", e);
  }
};

const runTick = async (): Promise<void> => {
  const start = performance.now();
  const due = await query<Blog>`
    SELECT * FROM blogs
    WHERE id IN (SELECT DISTINCT blog_id FROM list_blogs)
      AND (
        last_fetched_at IS NULL
        OR last_fetched_at < NOW() - (INTERVAL '1 hour' * ${STALE_HOURS})
      )
  `;
  if (due.length > 0) {
    console.log(
      `[poller] tick: ${due.length} blogs due, concurrency=${CONCURRENCY}`,
    );
    await runWithConcurrency(due, CONCURRENCY, fetchAndIngestBlog);
    const elapsed = ((performance.now() - start) / 1000).toFixed(1);
    console.log(`[poller] tick complete in ${elapsed}s`);
  } else {
    console.log("[poller] no blogs due");
  }
  await pingHealthcheck();
};

let started = false;

export const startPoller = (): void => {
  if (started) return;
  started = true;

  setInterval(() => {
    runTick().catch((e) => console.error("[poller] tick failed:", e));
  }, TICK_INTERVAL_MS);

  // Run once on boot so we don't wait up to 5 minutes after deploy.
  runTick().catch((e) => console.error("[poller] initial tick failed:", e));
};
