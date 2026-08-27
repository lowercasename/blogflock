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
  const html = `<img src="https://example.test/a.jpg">` +
    `<p>${words(40)}</p>`;
  const excerpt = createExcerpt(html, 50);
  assertEquals(countImages(excerpt), 1);
  const textWords = excerpt.replace(/<[^>]+>/g, " ").trim().split(/\s+/)
    .filter((w) => w !== "…" && w.length > 0);
  assertEquals(textWords.length, 35);
});

Deno.test("excerpt: the second image ends the excerpt", () => {
  const html = `<img src="https://example.test/a.jpg">` +
    `<img src="https://example.test/b.jpg">` +
    `<p>${words(40)}</p>`;
  const excerpt = createExcerpt(html, 50);
  assertEquals(countImages(excerpt), 2);
  assertEquals(excerpt.includes("w0"), false);
});

Deno.test("excerpt: text-only posts are unaffected by image budget", () => {
  const excerpt = createExcerpt(`<p>${words(30)}</p>`, 50);
  const textWords = excerpt.replace(/<[^>]+>/g, " ").trim().split(/\s+/)
    .filter((w) => w.length > 0);
  assertEquals(textWords.length, 30);
});

Deno.test("excerpt: images inside anchors don't bypass the cap", () => {
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

Deno.test("excerpt: capped images don't leave empty wrapper paragraphs", () => {
  const html = Array.from(
    { length: 30 },
    (_, i) => `<p>\n<img src="https://example.test/${i}.jpg">\n</p>`,
  ).join("\n");
  const excerpt = createExcerpt(html, 50);
  assertEquals(countImages(excerpt), 2);
  assertEquals((excerpt.match(/<p/g) ?? []).length, 2);
});

Deno.test("excerpt: pruning keeps paragraphs that still have text", () => {
  const html = `<p><img src="https://example.test/a.jpg"></p>` +
    `<p>Some real words here</p>` +
    `<p>   </p>`;
  const excerpt = createExcerpt(html, 50);
  assertEquals(countImages(excerpt), 1);
  assertEquals((excerpt.match(/<p/g) ?? []).length, 2);
  assertEquals(excerpt.includes("Some real words here"), true);
});

Deno.test("excerpt: no orphaned captions from capped figures", () => {
  const fig = (i: number) =>
    `<figure><img src="https://example.test/${i}.jpg"><figcaption>Caption number ${i} here</figcaption></figure>`;
  const html = Array.from({ length: 20 }, (_, i) => fig(i)).join("\n");
  const excerpt = createExcerpt(html, 50);
  assertEquals(countImages(excerpt), 2);
  assertEquals((excerpt.match(/<figure/g) ?? []).length, 2);
  assertEquals(excerpt.includes("Caption number 0 here"), true);
  assertEquals(excerpt.includes("Caption number 2 here"), false);
});
