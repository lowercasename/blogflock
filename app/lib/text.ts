import { DOMParser, Node } from "jsr:@b-fuze/deno-dom";
import * as ammonia from "https://deno.land/x/ammonia@0.3.1/mod.ts";
import { encodeHex } from "jsr:@std/encoding/hex";

await ammonia.init();

export type ContentExcerpt = {
    type: "text" | "image";
    content: string;
    alt?: string | null;
    image?: string | null;
};

export const excerpt = (str: string, words: number): ContentExcerpt => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(str, "text/html");
    const body = doc.body;

    // Look at the first few nodes for images - if an image is found, this is probably
    // a webcomic or image post
    const EARLY_NODE_THRESHOLD = 12;
    let nodeCount = 0;
    let foundEarlyImage = false;

    const generateShortContent = (text: string) => {
        const textWords = text.split(/\s+/).filter((word) => word.length > 0);
        const textRequiresEllipsis = textWords.length > words;
        const excerptWords = textWords
            .slice(0, words)
            .join(" ") + (textRequiresEllipsis ? "…" : "");
        return excerptWords;
    };

    const walkEarlyNodes = (node: Node) => {
        if (nodeCount > EARLY_NODE_THRESHOLD) return;
        if (node.nodeName === "IMG") {
            foundEarlyImage = true;
            return;
        }
        nodeCount++;
        for (const child of Array.from(node.childNodes)) {
            walkEarlyNodes(child);
        }
    };

    walkEarlyNodes(body);

    if (foundEarlyImage) {
        const firstImage = doc.getElementsByTagName(
            "img",
        )[0];
        return {
            type: "image",
            content: generateShortContent(doc.textContent),
            image: firstImage.getAttribute("src"),
            alt: firstImage.getAttribute("alt"),
        };
    }

    return {
        type: "text",
        content: generateShortContent(doc.textContent),
    };
};

// From: https://www.codemzy.com/blog/make-word-plural-javascript
export function pluralize(count: number, single: string, plural?: string) {
    if (count !== 1 && plural) {
        return plural;
    }
    return `${single}${count === 1 ? "" : "s"}`;
}

export async function hash(str: string): Promise<string> {
    const strBuffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-256", strBuffer);
    const hash = encodeHex(hashBuffer);
    return hash;
}
