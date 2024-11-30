import { DOMParser } from "jsr:@b-fuze/deno-dom";
import * as ammonia from "https://deno.land/x/ammonia@0.3.1/mod.ts";
await ammonia.init();

export const excerpt = (html: string, words: number): string => {
    const text = new DOMParser().parseFromString(html, "text/html").textContent;
    const textWords = text?.split(" ");
    if (!textWords) {
        return "";
    }
    const textRequiresEllipsis = textWords?.length > words;
    const excerptWords = textWords.slice(0, words).join(" ") +
        (textRequiresEllipsis ? "…" : "");
    return excerptWords;

    // const text = new DOMParser().parseFromString(html, "text/html")
    //     .documentElement?.getElementsByTagName("body")[0]?.innerHTML;
    // const textWords = text?.split(" ");
    // if (!textWords) {
    //     return "";
    // }
    // const textRequiresEllipsis = textWords?.length > words;
    // const excerptWords = textWords.slice(0, words).join(" ") +
    //     (textRequiresEllipsis ? "…" : "");
    // const sanitized = ammonia.clean(excerptWords);
    // return sanitized;
};

// From: https://www.codemzy.com/blog/make-word-plural-javascript
export function pluralize(count: number, single: string, plural?: string) {
    if (count !== 1 && plural) {
        return plural;
    }
    return `${single}${count === 1 ? "" : "s"}`;
};