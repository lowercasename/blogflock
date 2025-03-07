import { DOMParser, Element, Node } from "jsr:@b-fuze/deno-dom";
import * as ammonia from "https://deno.land/x/ammonia@0.3.1/mod.ts";
import { encodeHex } from "jsr:@std/encoding/hex";
import markdownit from "npm:markdown-it";

await ammonia.init();

/**
 * Extract an excerpt from HTML content with approximately the specified word count.
 * This function tries to keep anchor tags intact even if they exceed the word count.
 * @param html The HTML content to extract from
 * @param wordCount The target word count for the excerpt (default: 50)
 * @returns The HTML excerpt
 */
export function createExcerpt(html: string, wordCount = 50): string {
  // Sanitize the HTML
  const sanitizedHtml = ammonia.clean(html);
  const document = new DOMParser().parseFromString(sanitizedHtml, "text/html");
  if (!document) {
    throw new Error("Failed to parse HTML");
  }

  const clonedDoc = new DOMParser().parseFromString("<div></div>", "text/html");
  if (!clonedDoc) {
    throw new Error("Failed to create output document");
  }
  
  const rootContainer = clonedDoc.querySelector("div");
  if (!rootContainer) {
    throw new Error("Failed to create output container");
  }
  
  // State
  let currentWordCount = 0;
  let excerptComplete = false;
  
  function walkNode(node: Node, parentNode: Node, isAnchor = false): void {
    // Fully process anchor tags, even if over word count
    if (excerptComplete && !isAnchor) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      const words = text.trim().split(/\s+/).filter(word => word.length > 0);
      
      if (words.length === 0) {
        // Just whitespace so copy the original text
        parentNode.appendChild(clonedDoc.createTextNode(text));
        return;
      }
      
      if (currentWordCount + words.length <= wordCount) {
        // Text fits completely inside the word count
        parentNode.appendChild(clonedDoc.createTextNode(text));
        currentWordCount += words.length;
      } else {
        // Text needs to be truncated
        const remainingWords = wordCount - currentWordCount;
        if (remainingWords <= 0) {
          excerptComplete = true;
          return;
        }

        const includedWords = words.slice(0, remainingWords);
        
        // Preserve whitespace prefix
        const prefix = text.match(/^\s*/)?.[0] || "";
        
        // Create truncated text node
        const truncatedText = prefix + includedWords.join(" ");
        parentNode.appendChild(clonedDoc.createTextNode(truncatedText));
        
        if (!isAnchor) {
          parentNode.appendChild(clonedDoc.createTextNode("…"));
        }
        
        currentWordCount += remainingWords;
        excerptComplete = true;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();
      
      if (["img", "br", "hr"].includes(tagName)) {
        parentNode.appendChild(element.cloneNode());
        return;
      }

      const newElement = clonedDoc.createElement(tagName);
      
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        newElement.setAttribute(attr.name, attr.value);
      }

      // Add target="_blank" to links
      if (tagName === "a") {
        newElement.setAttribute("target", "_blank");
      }
      
      const isCurrentAnchor = tagName === "a";

      // We might be inside a nested anchor tag (why would you do this?)
      const isInsideAnchor = isAnchor || isCurrentAnchor;
      
      // Process children
      const childNodes = Array.from(element.childNodes);
      
      for (const childNode of childNodes) {
        walkNode(childNode, newElement, isInsideAnchor);
        if (excerptComplete && !isInsideAnchor) {
          break;
        }
      }
      
      // Add ellipsis after leaving outside anchor tags if needed
      if (isCurrentAnchor && excerptComplete && !isAnchor) {
        newElement.appendChild(clonedDoc.createTextNode("…"));
      }
      
      parentNode.appendChild(newElement);
    }
  }
  
  const bodyNodes = Array.from(document.body.childNodes);
  for (const node of bodyNodes) {
    if (excerptComplete) {
      break;
    }
    walkNode(node, rootContainer);
  }

  return rootContainer.innerHTML;
}

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

export const markdownToHtml = async (markdown: string): Promise<string> => {
  const md = markdownit({
    linkify: true,
  });
  const html = await md.render(markdown);
  return html;
};
