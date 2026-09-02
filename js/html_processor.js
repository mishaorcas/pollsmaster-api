const H2_BLOCK_SOURCE = "<h2\\b[^>]*>[\\s\\S]*?<\\/h2>";

// Python re module equivalents (re.DOTALL -> `s`, re.IGNORECASE -> `i`).
const HL_PATTERN = /<hl\b[^>]*>([\s\S]*?)<\/hl>/gi;
const H2_BLOCK_SPLIT_PATTERN = /(<h2\b[^>]*>[\s\S]*?<\/h2>)/gi;
const H2_BLOCK_G = new RegExp(H2_BLOCK_SOURCE, "gi"); // all matches
const H2_BLOCK = new RegExp(H2_BLOCK_SOURCE, "i");    // first match / fullmatch check
const HL_PLACEHOLDER_PATTERN = /__HL_PLACEHOLDER_(\d+)__/g;
const LEAD_PATTERN = /<lead\b[^>]*>[\s\S]*?<\/lead>/i;
const CONTENTS_PATTERN = /<contents\b[^>]*>([\s\S]*?)<\/contents>/i;
const CONTENTS_ENTRY_PATTERN = /\{([^}]+)\}\s*\(\s*#(\w+)\s*\)/gi;

const EMPTY_AUTHOR_PATTERN = /<author>\s*<description>\s*<\/description>\s*<\/author>/i;
const EMPTY_AUTHOR_PATTERN_G = /<author>\s*<description>\s*<\/description>\s*<\/author>/gi;

const AUTHOR_LINK_SOURCE =
  "<p>\\s*\\{([^{}\\n]{1,80})\\}\\(([^)\\s]+)\\)\\s*<\\/p>\\s*<p>\\s*([\\s\\S]*?)\\s*<\\/p>";
const AUTHOR_LINK_G = new RegExp(AUTHOR_LINK_SOURCE, "gi");
const AUTHOR_LINK = new RegExp(AUTHOR_LINK_SOURCE, "i");

const AUTHOR_NAME_SOURCE =
  "<p>\\s*([^<>\\n]{1,80})\\s*<\\/p>\\s*<p>\\s*([\\s\\S]*?)\\s*<\\/p>";
const AUTHOR_NAME_G = new RegExp(AUTHOR_NAME_SOURCE, "gi");
const AUTHOR_NAME = new RegExp(AUTHOR_NAME_SOURCE, "i");

const SOCIAL_ID_PATTERN = /user(\d+)\b/i;
const NAME_TOKEN_PATTERN = /^[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё'-]*$/;

const POSITIVE_MARKERS = ["👍", "positive", "plus", "плюсы", "плюс"];
const NEGATIVE_MARKERS = ["👎", "negative", "minus", "минусы", "минус"];

// English ordinal words for IDs: one, two, three, ...
const EN_NUMBERS = [
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
  "eighteen", "nineteen", "twenty",
];

/**
 * Return English word for 1-based index: 1->one, 2->two, ...
 */
function englishNumber(n) {
  if (n <= 0) {
    throw new Error(`Expected positive integer, got ${n}`);
  }
  if (n <= 20) {
    return EN_NUMBERS[n - 1];
  }
  // For numbers > 20, fall back to numeric string
  return String(n);
}

/**
 * Remove all HTML tags and normalize whitespace to plain text.
 */
function stripHtmlTags(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * If the text contains a <contents>...</contents> TOC block, assign ids to the
 * matching <h2> headers.
 *
 * Each TOC entry has the form: {header text}(#anchor)
 *
 * Strategy:
 * 1. If the header text inside {} matches the <h2> content (as plain text),
 *    assign sequential English-word ids: one, two, three, ...
 * 2. If the texts do not match, use the anchor from the TOC entry as the id,
 *    assigning them sequentially to h2 headers in order.
 */
function assignContentIdsToHeaders(text) {
  const contentsMatch = text.match(CONTENTS_PATTERN);
  if (!contentsMatch) {
    return text;
  }

  const contentsBody = contentsMatch[1];

  // Parse all entries from the TOC: extract text and anchor
  const entries = [...contentsBody.matchAll(CONTENTS_ENTRY_PATTERN)];
  if (entries.length === 0) {
    return text;
  }

  const tocHeaderTexts = [];
  const tocAnchors = [];
  for (const entry of entries) {
    tocHeaderTexts.push(stripHtmlTags(entry[1]));
    tocAnchors.push(entry[2]);
  }

  // Find all <h2> tags in the document
  const h2Matches = [...text.matchAll(H2_BLOCK_G)];
  if (h2Matches.length === 0) {
    return text;
  }

  // Try to match by text first
  const h2IdMap = new Map();
  let tocIndex = 0;

  for (let h2Idx = 0; h2Idx < h2Matches.length; h2Idx++) {
    const h2Plain = stripHtmlTags(h2Matches[h2Idx][0]);

    if (tocIndex < tocHeaderTexts.length && h2Plain === tocHeaderTexts[tocIndex]) {
      // Text matches — assign sequential id
      h2IdMap.set(h2Idx, englishNumber(tocIndex + 1));
      tocIndex += 1;
    }
  }

  // If no h2 was matched by text, fallback: assign anchors sequentially
  if (h2IdMap.size === 0) {
    h2IdMap.clear();
    for (let i = 0; i < h2Matches.length; i++) {
      if (i < tocAnchors.length) {
        h2IdMap.set(i, tocAnchors[i]);
      }
    }
  }

  if (h2IdMap.size === 0) {
    return text;
  }

  // Rebuild the string with ids injected into matching h2 tags
  let result = "";
  let lastEnd = 0;

  for (let h2Idx = 0; h2Idx < h2Matches.length; h2Idx++) {
    if (!h2IdMap.has(h2Idx)) {
      continue;
    }

    // Append everything before this h2 match
    result += text.slice(lastEnd, h2Matches[h2Idx].index);

    // Insert id into the opening tag: <h2 ... > -> <h2 id="xxx" ... >
    const h2Tag = h2Matches[h2Idx][0];
    const idValue = h2IdMap.get(h2Idx);

    const h2WithId = h2Tag.replace(
      /(<h2)(\b[^>]*>)/i,
      `$1 id="${idValue}"$2`
    );
    result += h2WithId;
    lastEnd = h2Matches[h2Idx].index + h2Tag.length;
  }

  // Append the rest
  result += text.slice(lastEnd);

  return result;
}

/**
 * Replace ➕ emoji at the start of h2 content with <image src="plus-icon" />
 * and ➖ emoji with <image src="minus-icon" />.
 */
function replaceEmojiInH2Headers(text) {
  return text.replace(H2_BLOCK_G, (fullTag) => {
    const openMatch = fullTag.match(/^(<h2\b[^>]*>)([\s\S]*?)(<\/h2>)/i);
    if (!openMatch) {
      return fullTag;
    }

    const opening = openMatch[1];
    const content = openMatch[2];
    const closing = openMatch[3];

    // Check if content starts with ➕ or ➖ (possibly with leading whitespace)
    const plusMatch = content.match(/^(\s*)➕([\s\S]+)$/);
    if (plusMatch) {
      const rest = plusMatch[2].trim();
      return `${opening}\n<image src="plus-icon" />\n${rest}\n${closing}`;
    }

    const minusMatch = content.match(/^(\s*)➖([\s\S]+)$/);
    if (minusMatch) {
      const rest = minusMatch[2].trim();
      return `${opening}\n<image src="minus-icon" />\n${rest}\n${closing}`;
    }

    return fullTag;
  });
}

function processHtml(text) {
  if (typeof text !== "string") {
    throw new Error("Input must be a string.");
  }
  if (!text.trim()) {
    return text;
  }

  let processed = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Assign IDs to h2 headers based on contents TOC
  processed = assignContentIdsToHeaders(processed);

  // Replace ➕/➖ emojis in h2 headers with image tags
  processed = replaceEmojiInH2Headers(processed);

  const extracted = extractHlBlocks(processed);
  processed = extracted.text;

  processed = replacePrimaryAuthorBeforeLead(processed);
  processed = replaceAuthorWithSocialId(processed);
  processed = replaceAuthorWithName(processed);
  processed = restoreHlBlocks(processed, extracted.contents);
  processed = removeEmptyAuthorBlocks(processed);
  processed = normalizeSpacing(processed);

  return processed.trim();
}

function extractHlBlocks(text) {
  const hlContents = [];

  const result = text.replace(HL_PATTERN, (match, content) => {
    hlContents.push(content);
    return `__HL_PLACEHOLDER_${hlContents.length - 1}__`;
  });

  return { text: result, contents: hlContents };
}

function replacePrimaryAuthorBeforeLead(text) {
  const leadMatch = text.match(LEAD_PATTERN);
  if (!leadMatch) {
    return text;
  }

  const beforeLead = text.slice(0, leadMatch.index);
  const afterLead = text.slice(leadMatch.index);

  const linkMatch = beforeLead.match(AUTHOR_LINK);
  if (linkMatch) {
    return movePrimaryAuthorToTop(beforeLead, afterLead, linkMatch);
  }

  const nameMatch = beforeLead.match(AUTHOR_NAME);
  if (nameMatch && isProbableAuthorName(nameMatch[1].trim().split(/\s+/).join(" "))) {
    return movePrimaryAuthorToTop(beforeLead, afterLead, nameMatch);
  }

  return text;
}

function movePrimaryAuthorToTop(beforeLead, afterLead, match) {
  const description = match[3].trim();
  if (!description) {
    return beforeLead + afterLead;
  }

  const replacement = `<author>\n    <description>${description}</description>\n</author>`;

  const remainingBeforeLead =
    beforeLead.slice(0, match.index) + beforeLead.slice(match.index + match[0].length);

  if (remainingBeforeLead.search(EMPTY_AUTHOR_PATTERN) !== -1) {
    const filled = remainingBeforeLead.replace(EMPTY_AUTHOR_PATTERN, replacement);
    return `${filled}${afterLead}`.trim();
  }

  const remaining = `${remainingBeforeLead}${afterLead}`.trim();
  if (!remaining) {
    return replacement;
  }
  return `${replacement}\n\n${remaining}`;
}

function removeEmptyAuthorBlocks(text) {
  return text.replace(EMPTY_AUTHOR_PATTERN_G, "");
}

function replaceAuthorWithSocialId(text) {
  return text.replace(AUTHOR_LINK_G, (match, name, link, description) => {
    description = description.trim();
    const userMatch = link.match(SOCIAL_ID_PATTERN);
    if (!userMatch || !description) {
      return match;
    }

    const userId = userMatch[1];
    return (
      `<author prop="additional" social_id="${userId}">\n` +
      `    <description>${description}</description>\n` +
      `</author>`
    );
  });
}

function replaceAuthorWithName(text) {
  return text.replace(AUTHOR_NAME_G, (match, name, description) => {
    name = name.trim().split(/\s+/).join(" ");
    description = description.trim();
    if (!isProbableAuthorName(name) || !description) {
      return match;
    }

    return (
      `<author-ugc name="${name}" prop="additional" img="">\n` +
      `    <description>${description}</description>\n` +
      `</author-ugc>`
    );
  });
}

function isProbableAuthorName(value) {
  if (!value || value.length > 80) {
    return false;
  }
  if (/[.!?;:,]$/.test(value)) {
    return false;
  }

  const tokens = value.split(" ");
  if (tokens.length > 4) {
    return false;
  }

  for (const token of tokens) {
    if (!NAME_TOKEN_PATTERN.test(token)) {
      return false;
    }
    if (token[0] !== token[0].toUpperCase()) {
      return false;
    }
  }

  return true;
}

function restoreHlBlocks(text, hlContents) {
  const parts = text.split(H2_BLOCK_SPLIT_PATTERN);
  if (parts.length === 0) {
    return text;
  }

  let currentSurface = "positive";
  const restoredParts = [];

  for (const part of parts) {
    if (!part) {
      continue;
    }

    const h2Match = part.match(H2_BLOCK);
    if (h2Match && h2Match[0] === part) {
      currentSurface = surfaceFromHeader(part, currentSurface);
      restoredParts.push(part);
      continue;
    }

    const restored = part.replace(HL_PLACEHOLDER_PATTERN, (match, indexStr) => {
      const index = parseInt(indexStr, 10);
      if (index >= hlContents.length) {
        return match;
      }

      const cleanedContent = normalizeHlContent(hlContents[index]);
      if (!cleanedContent) {
        return `<bubble surface="${currentSurface}"></bubble>`;
      }

      return (
        `<bubble surface="${currentSurface}">\n` +
        `${cleanedContent}\n` +
        `</bubble>`
      );
    });

    restoredParts.push(restored);
  }

  return restoredParts.join("");
}

function surfaceFromHeader(h2Html, currentSurface) {
  const plainHeader = h2Html.replace(/<[^>]+>/g, " ").toLowerCase();
  if (NEGATIVE_MARKERS.some((marker) => plainHeader.includes(marker))) {
    return "negative";
  }
  if (POSITIVE_MARKERS.some((marker) => plainHeader.includes(marker))) {
    return "positive";
  }
  return currentSurface;
}

function normalizeHlContent(content) {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.join("\n\n");
}

function normalizeSpacing(text) {
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.replace(/<\/author-ugc>\s*<h2/gi, "</author-ugc>\n\n<h2");
  text = text.replace(/<\/author>\s*<h2/gi, "</author>\n\n<h2");
  text = text.replace(/<\/bubble>\s*<h2/gi, "</bubble>\n\n<h2");
  text = text.replace(/<\/h2>\s*<author-ugc/gi, "</h2>\n\n<author-ugc");
  text = text.replace(/<\/h2>\s*<author(?![\w-])/gi, "</h2>\n\n<author");
  text = text.replace(/<\/h2>\s*<p/gi, "</h2>\n\n<p");
  return text;
}

export {
  processHtml,
  englishNumber,
  stripHtmlTags,
  assignContentIdsToHeaders,
  replaceEmojiInH2Headers,
  isProbableAuthorName,
};