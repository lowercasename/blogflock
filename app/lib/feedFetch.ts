import { parseFeed } from "https://deno.land/x/rss@1.1.1/mod.ts";
import {
  Blog,
  updateBlogLastModifiedAt,
  updateBlogStats,
} from "../models/Blog.ts";
import {
  createPost,
  generatePostGuid,
  getPostByGuid,
} from "../models/Post.ts";
import { getAllListsContainingBlog } from "../models/List.ts";
import { broadcastNewPost } from "./websockets.ts";

const FETCH_TIMEOUT_MS = 30_000;

export interface FetchResult {
  newPosts: number;
  notModified: boolean;
  skipped: boolean;
}

const parseLastModifiedHeader = (raw: string): Date | null => {
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
};

// The deno-rss library populates date fields by calling `new Date(raw)`,
// which produces an Invalid Date *object* (not null) when the string isn't
// JS-parseable. Validate before trusting.
const validDate = (v: unknown): Date | null => {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (typeof v === "string" && v.trim()) {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

// Resolve an entry's date as leniently as possible. Atom feeds frequently
// omit <published> and only carry <updated> (e.g. static-site generators),
// so fall through to those fields before giving up. gofeed did this fallback
// silently in the previous Go pipeline; deno-rss exposes the fields raw.
// deno-lint-ignore no-explicit-any
const resolveEntryDate = (entry: any): Date | null => {
  return (
    validDate(entry.published) ??
      validDate(entry.publishedRaw) ??
      validDate(entry.updated) ??
      validDate(entry.updatedRaw)
  );
};

export const fetchAndIngestBlog = async (
  blog: Blog,
): Promise<FetchResult> => {
  const headers: HeadersInit = { "User-Agent": "BlogFlock/1.0" };
  if (blog.last_modified_at) {
    headers["If-Modified-Since"] = blog.last_modified_at.toUTCString();
  }

  let res: Response;
  try {
    res = await fetch(blog.feed_url, {
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
  } catch (e) {
    console.error(`[feed] fetch failed ${blog.feed_url}: ${e}`);
    return { newPosts: 0, notModified: false, skipped: true };
  }

  if (res.status === 304) {
    // Match the success path's logging — silently swallowing here means a
    // failed updateBlogStats (e.g. last_fetched_at not advancing) would
    // re-fetch this feed every tick forever with no visible signal.
    await updateBlogStats(blog.id).catch((e) =>
      console.error(`[feed] updateBlogStats failed for 304 ${blog.feed_url}: ${e}`)
    );
    return { newPosts: 0, notModified: true, skipped: false };
  }
  if (!res.ok) {
    console.error(`[feed] HTTP ${res.status} for ${blog.feed_url}`);
    await res.body?.cancel();
    return { newPosts: 0, notModified: false, skipped: true };
  }

  let xml: string;
  try {
    xml = await res.text();
  } catch (e) {
    console.error(`[feed] body read failed ${blog.feed_url}: ${e}`);
    return { newPosts: 0, notModified: false, skipped: true };
  }

  const lastModifiedHeader = res.headers.get("Last-Modified");
  if (lastModifiedHeader) {
    const parsed = parseLastModifiedHeader(lastModifiedHeader);
    if (parsed) {
      await updateBlogLastModifiedAt(blog.id, parsed).catch((e) =>
        console.error(`[feed] updateBlogLastModifiedAt failed: ${e}`)
      );
    }
  }

  let feed;
  try {
    feed = await parseFeed(xml);
  } catch (e) {
    console.error(`[feed] parse failed ${blog.feed_url}: ${e}`);
    return { newPosts: 0, notModified: false, skipped: true };
  }

  const lastPublishedAt = blog.last_published_at;
  let newPosts = 0;
  let skippedNoDate = 0;

  for (const entry of feed.entries ?? []) {
    // Skip rather than fall back to NOW: if the feed owner later adds a
    // proper <published>/<updated>, we'll pick the entry up on the next
    // poll with the correct date. NOW would lock in a wrong date forever.
    const publishedAt = resolveEntryDate(entry);
    if (!publishedAt) {
      skippedNoDate++;
      const url = entry.links?.[0]?.href ?? "";
      console.warn(
        `[feed] skipping entry without parseable date in ${blog.feed_url} ` +
          `(${url || "no link"}). ` +
          // deno-lint-ignore no-explicit-any
          `published=${JSON.stringify((entry as any).publishedRaw)} ` +
          // deno-lint-ignore no-explicit-any
          `updated=${JSON.stringify((entry as any).updatedRaw)}`,
      );
      continue;
    }

    if (lastPublishedAt && publishedAt <= lastPublishedAt) {
      continue;
    }

    const title = entry.title?.value ?? "";
    const url = entry.links?.[0]?.href ?? "";
    const content =
      // deno-lint-ignore no-explicit-any
      (entry as any).content?.value ??
        // deno-lint-ignore no-explicit-any
        (entry as any).description?.value ??
        "";
    const rawGuid = entry.id ?? undefined;

    const guid = await generatePostGuid({
      guid: rawGuid,
      url,
      title,
      published_at: publishedAt,
    });

    const existing = await getPostByGuid(guid, blog.id);
    if (existing) continue;

    try {
      const created = await createPost({
        blog_id: blog.id,
        title,
        content,
        url,
        published_at: publishedAt,
        guid,
      });
      if (created) newPosts++;
    } catch (e) {
      // Postgres SQLSTATE 23505 = unique_violation. The (blog_id, guid)
      // unique index can race when the same feed is fetched by two ticks
      // overlapping; that's expected and harmless. Anything else (NOT NULL
      // violation, FK violation, connection drop, statement timeout) is a
      // real bug — surface it to the poller's worker catch.
      // deno-lint-ignore no-explicit-any
      const code = (e as any)?.fields?.code;
      if (code === "23505") {
        continue;
      }
      throw e;
    }
  }

  await updateBlogStats(blog.id).catch((e) =>
    console.error(`[feed] updateBlogStats failed: ${e}`)
  );

  if (newPosts > 0) {
    try {
      const lists = await getAllListsContainingBlog(blog.id);
      broadcastNewPost(lists);
    } catch (e) {
      console.error(`[feed] broadcast failed: ${e}`);
    }
  }

  console.log(
    `[feed] ${blog.feed_url}: ${newPosts} new post(s)` +
      (skippedNoDate > 0
        ? ` (${skippedNoDate} skipped: no parseable date)`
        : ""),
  );
  return { newPosts, notModified: false, skipped: false };
};
