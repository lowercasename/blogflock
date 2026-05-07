// Integration tests for the in-process feed poller's date handling.
//
// Each test seeds a real postgres (via the harness in setup.ts) and a real
// in-process HTTP server that returns canned XML. We call the actual
// `fetchAndIngestBlog` function — no mocks of the parser or DB — so these
// tests would have caught the recent date-related bugs:
//
//   1. "All imported posts get today's date" — caused by Invalid Date
//      objects from deno-rss being silently substituted with NOW.
//   2. "Atom feeds with only <updated> get today's date" — caused by the
//      published→updated fallback being missing.
//
// Run with: deno task test:integration

// setup.ts MUST be the first import: it has a side-effect import of
// List.ts that resolves a Blog/List/ListBlog initialization-order cycle.
import {
  atomFeed,
  FeedServer,
  resetDb,
  seedBlog,
  seedList,
  seedUser,
  startFeedServer,
} from "./setup.ts";
import { assertEquals, assertExists } from "jsr:@std/assert@1";
import { getBlogById } from "../models/Blog.ts";
import { fetchAndIngestBlog } from "../lib/feedFetch.ts";
import { query } from "../lib/db.ts";

interface PostRow {
  id: number;
  title: string;
  published_at: Date;
}

const postsForBlog = async (blogId: number): Promise<PostRow[]> => {
  return await query<PostRow>`
    SELECT id, title, published_at
    FROM posts
    WHERE blog_id = ${blogId}
    ORDER BY published_at ASC
  `;
};

const fetchBlog = async (blogId: number) => {
  const blog = await getBlogById(blogId);
  assertExists(blog, "seeded blog should be loadable");
  return await fetchAndIngestBlog(blog);
};

// Higher-order helper: handle the common reset → seed user/list/blog →
// start feed server → run test → stop server lifecycle. Tests stay focused
// on assertions.
const withFeedTest = async (
  feeds: Record<string, string>,
  body: (ctx: {
    server: FeedServer;
    feedUrl: (path: string) => string;
    seedAndFetch: (path: string, opts?: { lastPublishedAt?: Date }) => Promise<
      { blogId: number; result: Awaited<ReturnType<typeof fetchAndIngestBlog>> }
    >;
  }) => Promise<void>,
) => {
  await resetDb();
  const user = await seedUser();
  const list = await seedList(user.id);
  const server = await startFeedServer(feeds);
  try {
    await body({
      server,
      feedUrl: (path) => `${server.baseUrl}${path}`,
      seedAndFetch: async (path, opts = {}) => {
        const blogId = await seedBlog({
          feedUrl: `${server.baseUrl}${path}`,
          listId: list.id,
          lastPublishedAt: opts.lastPublishedAt ?? null,
        });
        const result = await fetchBlog(blogId);
        return { blogId, result };
      },
    });
  } finally {
    await server.stop();
  }
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

Deno.test("poller: Atom feed with <published> uses published date", async () => {
  const xml = atomFeed("With Published", [
    {
      title: "First Post",
      link: "http://example.test/1",
      published: "2025-03-01T10:00:00Z",
      updated: "2025-03-02T10:00:00Z",
    },
    {
      title: "Second Post",
      link: "http://example.test/2",
      published: "2025-04-01T10:00:00Z",
    },
  ]);
  await withFeedTest({ "/feed.xml": xml }, async ({ seedAndFetch }) => {
    const { blogId, result } = await seedAndFetch("/feed.xml");
    assertEquals(result.newPosts, 2);
    const posts = await postsForBlog(blogId);
    assertEquals(posts.length, 2);
    assertEquals(
      posts[0].published_at.toISOString(),
      "2025-03-01T10:00:00.000Z",
    );
    assertEquals(
      posts[1].published_at.toISOString(),
      "2025-04-01T10:00:00.000Z",
    );
  });
});

Deno.test(
  "poller: Atom feed with only <updated> falls back correctly (regression)",
  async () => {
    // The raphaelkabo.com case: Atom feeds from static-site generators
    // commonly omit <published> and only carry <updated>.
    const xml = atomFeed("Only Updated", [
      {
        title: "Updated Only Post",
        link: "http://example.test/x",
        updated: "2024-12-15T00:00:00Z",
      },
    ]);
    await withFeedTest({ "/feed.xml": xml }, async ({ seedAndFetch }) => {
      const { blogId, result } = await seedAndFetch("/feed.xml");
      assertEquals(result.newPosts, 1);
      const posts = await postsForBlog(blogId);
      assertEquals(posts.length, 1);
      assertEquals(
        posts[0].published_at.toISOString(),
        "2024-12-15T00:00:00.000Z",
      );
    });
  },
);

Deno.test(
  "poller: never stamps old entries with today's date (regression)",
  async () => {
    // Direct regression test for "all 57 imported posts have today's
    // date" — the silent NOW substitution bug.
    const xml = atomFeed("Old Posts", [
      {
        title: "Way Old",
        link: "http://example.test/old1",
        published: "2018-01-15T10:00:00Z",
      },
      {
        title: "Less Old",
        link: "http://example.test/old2",
        published: "2022-06-30T10:00:00Z",
      },
    ]);
    await withFeedTest({ "/feed.xml": xml }, async ({ seedAndFetch }) => {
      const { blogId } = await seedAndFetch("/feed.xml");
      const posts = await postsForBlog(blogId);
      const today = startOfToday();
      for (const p of posts) {
        const sameDay = p.published_at.getTime() >= today.getTime();
        assertEquals(
          sameDay,
          false,
          `post "${p.title}" was stamped with today's date (${p.published_at.toISOString()}) — date parsing regressed`,
        );
      }
    });
  },
);

Deno.test(
  "poller: entry with no parseable date is skipped, others ingested",
  async () => {
    const xml = atomFeed("Mixed Dates", [
      {
        title: "Has A Date",
        link: "http://example.test/a",
        published: "2025-01-10T10:00:00Z",
      },
      {
        title: "No Date At All",
        link: "http://example.test/b",
        // no published, no updated
      },
      {
        title: "Also Dated",
        link: "http://example.test/c",
        updated: "2025-02-20T10:00:00Z",
      },
    ]);
    await withFeedTest({ "/feed.xml": xml }, async ({ seedAndFetch }) => {
      const { blogId, result } = await seedAndFetch("/feed.xml");
      assertEquals(result.newPosts, 2);
      const posts = await postsForBlog(blogId);
      assertEquals(posts.length, 2);
      const titles = posts.map((p) => p.title).sort();
      assertEquals(titles, ["Also Dated", "Has A Date"]);
    });
  },
);

Deno.test(
  "poller: respects last_published_at, only inserts newer entries",
  async () => {
    const xml = atomFeed("Mixed Old/New", [
      {
        title: "Old (already seen)",
        link: "http://example.test/old",
        published: "2024-01-01T10:00:00Z",
      },
      {
        title: "Brand New",
        link: "http://example.test/new",
        published: "2025-12-01T10:00:00Z",
      },
    ]);
    await withFeedTest({ "/feed.xml": xml }, async ({ seedAndFetch }) => {
      const { blogId } = await seedAndFetch("/feed.xml", {
        lastPublishedAt: new Date("2024-06-01T00:00:00Z"),
      });
      const posts = await postsForBlog(blogId);
      assertEquals(posts.length, 1);
      assertEquals(posts[0].title, "Brand New");
    });
  },
);
