import { assertEquals } from "jsr:@std/assert@1";
import { createExcerpt } from "../lib/text.ts";

const countImages = (html: string): number =>
  (html.match(/<img/g) ?? []).length;

const words = (n: number): string =>
  Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

Deno.test("excerpt: keeps at most two images", () => {
  const html = Array.from(
    { length: 6 },
    (_, i) => `<img src="https://example.test/${i}.jpg">`,
  ).join("");
  const excerpt = createExcerpt(html, 50);
  assertEquals(countImages(excerpt), 2);
});

Deno.test("excerpt: images charge the word budget", () => {
  // Two images cost 30 of the 50-word budget, leaving 20 words of text.
  const html = `<img src="https://example.test/a.jpg">` +
    `<img src="https://example.test/b.jpg">` +
    `<p>${words(40)}</p>`;
  const excerpt = createExcerpt(html, 50);
  assertEquals(countImages(excerpt), 2);
  const textWords = excerpt.replace(/<[^>]+>/g, " ").trim().split(/\s+/)
    .filter((w) => w !== "…" && w.length > 0);
  assertEquals(textWords.length, 20);
});

Deno.test("excerpt: text-only posts are unaffected by image budget", () => {
  const excerpt = createExcerpt(`<p>${words(30)}</p>`, 50);
  const textWords = excerpt.replace(/<[^>]+>/g, " ").trim().split(/\s+/)
    .filter((w) => w.length > 0);
  assertEquals(textWords.length, 30);
});

Deno.test("excerpt: images inside anchors don't bypass the cap", () => {
  // The isAnchor exemption processes anchors fully even past the word
  // budget; images must still be capped inside them.
  const html = Array.from(
    { length: 5 },
    (_, i) =>
      `<a href="https://example.test/${i}"><img src="https://example.test/${i}.jpg"></a>`,
  ).join("");
  const excerpt = createExcerpt(html, 50);
  assertEquals(countImages(excerpt), 2);
});

Deno.test("excerpt: images after the word budget is spent are dropped", () => {
  const html = `<p>${words(60)}</p><img src="https://example.test/late.jpg">`;
  const excerpt = createExcerpt(html, 50);
  assertEquals(countImages(excerpt), 0);
});
