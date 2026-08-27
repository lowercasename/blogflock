import {
  atomFeed,
  resetDb,
  seedBlog,
  seedList,
  seedUser,
  startFeedServer,
} from "./setup.ts";
import { assertEquals } from "jsr:@std/assert@1";
import { fetchAndIngestBlog } from "../lib/feedFetch.ts";
import { getBlogById } from "../models/Blog.ts";
import { getListById, listToAtomFeed } from "../models/List.ts";
import { query } from "../lib/db.ts";

Deno.test("list feed: matches pre-written golden XML", async () => {
  await resetDb();
  const user = await seedUser();
  const list = await seedList(user.id);
  const server = await startFeedServer({
    "/feed.xml": atomFeed("Source Feed", [
      {
        title: "Post One",
        link: "http://example.test/1",
        published: "2025-05-01T10:00:00Z",
        content: "Hello &amp; welcome",
      },
      {
        title: "Post Two",
        link: "http://example.test/2",
        published: "2025-06-02T12:30:00Z",
        content: "&lt;p&gt;Second &quot;post&quot;&lt;/p&gt;",
      },
    ]),
  });
  try {
    const blogId = await seedBlog({
      feedUrl: `${server.baseUrl}/feed.xml`,
      listId: list.id,
    });
    await query`UPDATE blogs
      SET auto_title = 'Cool Blog', auto_author = 'Jane Doe'
      WHERE id = ${blogId}`;
    const blog = await getBlogById(blogId);
    await fetchAndIngestBlog(blog!);

    const fullList = await getListById(list.id);
    const xml = await listToAtomFeed(fullList!);

    assertEquals(
      xml,
      `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>test list - BlogFlock</title>
  <subtitle/>
  <link rel="alternate" href="https://blogflock.com/list/L_TEST"/>
  <link rel="self" href="https://blogflock.com/list/L_TEST/feed.xml"/>
  <id>https://blogflock.com/list/L_TEST</id>
  <updated>2025-06-02T12:30:00.000Z</updated>
  <generator>BlogFlock</generator>
  <author>
    <name>tester</name>
  </author>
  <entry>
    <title>Post Two - Cool Blog</title>
    <link href="http://example.test/2"/>
    <id>http://example.test/2</id>
    <updated>2025-06-02T12:30:00.000Z</updated>
    <author>
      <name>Jane Doe</name>
    </author>
    <content type="html">&lt;p&gt;Second "post"&lt;/p&gt;</content>
  </entry>
  <entry>
    <title>Post One - Cool Blog</title>
    <link href="http://example.test/1"/>
    <id>http://example.test/1</id>
    <updated>2025-05-01T10:00:00.000Z</updated>
    <author>
      <name>Jane Doe</name>
    </author>
    <content type="html">Hello &amp; welcome</content>
  </entry>
</feed>`,
    );
  } finally {
    await server.stop();
  }
});
