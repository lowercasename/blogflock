// Integration-test harness. Used by every *_test.ts file.
//
// Importing this module connects to the postgres at $POSTGRES_HOST/$PORT
// (via lib/db.ts's top-level await connect()), so the orchestration script
// (test/run.sh) must have a postgres up and the schema loaded BEFORE
// `deno test` runs.

// SAFETY: must be the very first import — runs the BLOGFLOCK_TEST_MODE
// + POSTGRES_DB-name guards before any code that touches lib/db.ts can
// load (db.ts has a top-level await connect()).
import "./_guard.ts";

// IMPORTANT: side-effect import to force List.ts to evaluate before
// feedFetch.ts pulls in Post.ts → ListBlog.ts. The Blog/List/ListBlog
// triangle has a TDZ-sensitive cycle that resolves cleanly when entered
// via List.ts (production's order, set by routes/lists.ts) but fails when
// entered via ListBlog.ts (which is what feedFetch's transitive imports
// would otherwise do in tests).
import "../models/List.ts";

import { query, queryOne } from "../lib/db.ts";

// Wipes every table the integration tests touch. Call at the top of each
// test (or in a beforeAll-ish block) so tests don't interfere with each
// other. RESTART IDENTITY makes IDs predictable.
export const resetDb = async (): Promise<void> => {
  await query`TRUNCATE TABLE
    posts,
    list_blogs,
    list_followers,
    bookmarked_posts,
    comments,
    lists,
    blogs,
    users
    RESTART IDENTITY CASCADE`;
};

export interface SeededUser {
  id: number;
  hash_id: string;
  email: string;
}

export const seedUser = async (
  overrides: Partial<{
    username: string;
    email: string;
    hash_id: string;
  }> = {},
): Promise<SeededUser> => {
  const u = {
    username: "tester",
    email: "tester@example.com",
    hash_id: "U_TEST",
    ...overrides,
  };
  const r = await queryOne<{ id: number }>`
    INSERT INTO users (username, email, password_hash, email_verified, hash_id)
    VALUES (${u.username}, ${u.email}, 'x', TRUE, ${u.hash_id})
    RETURNING id
  `;
  return { id: r!.id, hash_id: u.hash_id, email: u.email };
};

export const seedList = async (
  userId: number,
  hash_id = "L_TEST",
): Promise<{ id: number; hash_id: string }> => {
  const r = await queryOne<{ id: number }>`
    INSERT INTO lists (user_id, name, hash_id)
    VALUES (${userId}, 'test list', ${hash_id})
    RETURNING id
  `;
  return { id: r!.id, hash_id };
};

export interface SeedBlogOpts {
  feedUrl: string;
  hashId?: string;
  listId?: number;
  lastFetchedAt?: Date | null;
  lastPublishedAt?: Date | null;
}

export const seedBlog = async (opts: SeedBlogOpts): Promise<number> => {
  const hashId = opts.hashId ?? `B_${Math.random().toString(36).slice(2, 8)}`;
  const r = await queryOne<{ id: number }>`
    INSERT INTO blogs (
      feed_url, hash_id, last_fetched_at, last_published_at
    ) VALUES (
      ${opts.feedUrl},
      ${hashId},
      ${opts.lastFetchedAt ? opts.lastFetchedAt.toISOString() : null},
      ${opts.lastPublishedAt ? opts.lastPublishedAt.toISOString() : null}
    )
    RETURNING id
  `;
  if (opts.listId) {
    await query`
      INSERT INTO list_blogs (list_id, blog_id)
      VALUES (${opts.listId}, ${r!.id})
    `;
  }
  return r!.id;
};

// Spins up an in-process HTTP server that serves the given path → XML
// mapping. Returns once the listener is bound. Use stop() to release the
// port. The base URL is e.g. "http://localhost:54123".
export interface FeedServer {
  baseUrl: string;
  stop: () => Promise<void>;
}

export const startFeedServer = async (
  feeds: Record<string, string>,
): Promise<FeedServer> => {
  const ac = new AbortController();
  const ready = Promise.withResolvers<number>();
  const server = Deno.serve(
    {
      port: 0,
      signal: ac.signal,
      onListen: ({ port }) => ready.resolve(port),
    },
    (req) => {
      const path = new URL(req.url).pathname;
      const xml = feeds[path];
      if (xml === undefined) {
        return new Response("not found", { status: 404 });
      }
      return new Response(xml, {
        headers: { "content-type": "application/xml; charset=utf-8" },
      });
    },
  );
  const port = await ready.promise;
  return {
    baseUrl: `http://localhost:${port}`,
    stop: async () => {
      ac.abort();
      await server.finished.catch(() => {});
    },
  };
};

// Build a minimal Atom feed XML string from a list of entries. `published`
// and `updated` are optional — omit either to test fallback behavior.
export interface TestEntry {
  title: string;
  link?: string;
  id?: string;
  published?: string;
  updated?: string;
  content?: string;
}

export const atomFeed = (
  feedTitle: string,
  entries: TestEntry[],
): string => {
  const renderEntry = (e: TestEntry) => `
    <entry>
      <title>${e.title}</title>
      ${e.link ? `<link href="${e.link}"/>` : ""}
      <id>${e.id ?? e.link ?? e.title}</id>
      ${e.updated ? `<updated>${e.updated}</updated>` : ""}
      ${e.published ? `<published>${e.published}</published>` : ""}
      ${e.content ? `<content type="html">${e.content}</content>` : ""}
    </entry>`;
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${feedTitle}</title>
  <link href="http://example.test/"/>
  <updated>2026-05-07T00:00:00Z</updated>
  <id>http://example.test/</id>
  ${entries.map(renderEntry).join("\n")}
</feed>`;
};
