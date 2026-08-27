// One-off backfill for issue #13: posts ingested while deno-rss's CDATA
// wrapping left entity-encoded descriptions undecoded are stored as
// "&lt;p&gt;…" and render as visible tag soup. Re-run the same decode the
// poller now applies (lib/text.ts decodeEntityEncodedHtml) over existing
// rows. The decode is a no-op for correctly stored content, and the WHERE
// clause narrows the sweep to rows that can actually be affected.
//
// Run from app/ with the production .env available:
//   deno run -A --env-file scripts/backfill_encoded_posts.ts [--dry-run]
import { query } from "../lib/db.ts";
import { decodeEntityEncodedHtml } from "../lib/text.ts";

const dryRun = Deno.args.includes("--dry-run");

const rows = await query<{ id: number; content: string }>`
  SELECT id, content
  FROM posts
  WHERE content LIKE '%&lt;%'
    AND content NOT LIKE '%<%'
`;

console.log(`${rows.length} candidate post(s)`);

let updated = 0;
for (const row of rows) {
  const decoded = decodeEntityEncodedHtml(row.content);
  if (decoded === row.content) continue;
  if (!dryRun) {
    await query`UPDATE posts SET content = ${decoded} WHERE id = ${row.id}`;
  }
  updated++;
}

console.log(
  dryRun ? `${updated} post(s) would be updated` : `${updated} post(s) updated`,
);
Deno.exit(0);
