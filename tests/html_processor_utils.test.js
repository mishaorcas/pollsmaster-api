import { test } from "node:test";
import assert from "node:assert/strict";
import {
  processHtml,
  englishNumber,
  stripHtmlTags,
  assignContentIdsToHeaders,
  replaceEmojiInH2Headers,
  isProbableAuthorName,
} from "../js/html_processor.js";

/* ------------------------------------------------------------------ */
/* processHtml: input validation & preprocessing                       */
/* ------------------------------------------------------------------ */

test("processHtml throws on non-string input", () => {
  assert.throws(() => processHtml(null), /Input must be a string/);
  assert.throws(() => processHtml(undefined), /Input must be a string/);
  assert.throws(() => processHtml(42), /Input must be a string/);
  assert.throws(() => processHtml({}), /Input must be a string/);
});

test("processHtml returns empty string for empty input", () => {
  assert.equal(processHtml(""), "");
});

test("processHtml returns whitespace-only input unchanged", () => {
  assert.equal(processHtml("   \n\t "), "   \n\t ");
});

test("processHtml normalizes CRLF and CR line endings", () => {
  const source = "<p>{John Doe}(https://site.example/user77)</p>\r\n<p>Short bio</p>";
  const result = processHtml(source);
  assert.ok(result.includes("<author"));
  assert.ok(!result.includes("\r"));
});

test("processHtml does not transform author markup inside hl/bubble", () => {
  const source =
    "<h2>👍 Pros</h2>\n" +
    "<hl>\n" +
    "  <p>{John Doe}(https://site.example/user77)</p>\n" +
    "  <p>Bio inside bubble</p>\n" +
    "</hl>";
  const result = processHtml(source);
  assert.ok(result.includes('<bubble surface="positive">'));
  assert.ok(result.includes("{John Doe}"));
  assert.ok(result.includes("<author-ugc") === false);
});

/* ------------------------------------------------------------------ */
/* processHtml: author-ugc edge cases                                  */
/* ------------------------------------------------------------------ */

test("author link is case-insensitive on HTML tags", () => {
  const source =
    "<P>{John Doe}(https://site.example/user7)</P>\n" +
    "<P>Short bio</P>";
  const result = processHtml(source);
  assert.ok(result.includes('social_id="7"'));
});

test("author with multiple social id-like segments uses first user id", () => {
  const source =
    "<p>{John Doe}(https://site.example/user111/user222)</p>\n<p>Bio</p>";
  const result = processHtml(source);
  assert.ok(result.includes('social_id="111"'));
});

test("author with uppercase USER id segment", () => {
  const source =
    "<p>{John Doe}(https://site.example/USER42)</p>\n<p>Bio</p>";
  const result = processHtml(source);
  assert.ok(result.includes('social_id="42"'));
});

test("author link with empty description is left unchanged", () => {
  const source = "<p>{John Doe}(https://site.example/user1)</p>\n<p>  </p>";
  const result = processHtml(source);
  assert.ok(result.includes("<p>{John Doe}"));
  assert.ok(!result.includes("<author-ugc"));
});

test("plain name with trailing punctuation is not treated as author", () => {
  const source = "<p>John Doe.</p>\n<p>Description</p>";
  const result = processHtml(source);
  assert.ok(!result.includes("<author-ugc"));
  assert.ok(result.includes("<p>John Doe.</p>"));
});

test("plain name longer than 80 chars is not treated as author", () => {
  const longName = "A".repeat(81);
  const source = `<p>${longName}</p>\n<p>Description</p>`;
  const result = processHtml(source);
  assert.ok(!result.includes("<author-ugc"));
});

test("plain name with more than 4 words is not treated as author", () => {
  const source = "<p>John Michael David William Smith</p>\n<p>Description</p>";
  const result = processHtml(source);
  assert.ok(!result.includes("<author-ugc"));
});

test("plain name with lowercase word is not treated as author", () => {
  const source = "<p>John doe</p>\n<p>Description</p>";
  const result = processHtml(source);
  assert.ok(!result.includes("<author-ugc"));
});

test("single-word capitalized name is treated as author", () => {
  const source = "<p>John</p>\n<p>Description</p>";
  const result = processHtml(source);
  assert.ok(result.includes('<author-ugc name="John"'));
});

/* ------------------------------------------------------------------ */
/* processHtml: hl/bubble surface                                      */
/* ------------------------------------------------------------------ */

test("hl without preceding header defaults to positive", () => {
  const source = "<hl>Some content</hl>";
  const result = processHtml(source);
  assert.ok(result.includes('<bubble surface="positive">'));
});

test("hl surface switches negative on Russian 'минусы'", () => {
  const source = "<h2>Минусы</h2>\n<hl>Bad</hl>";
  const result = processHtml(source);
  assert.ok(result.includes('<bubble surface="negative">'));
});

test("hl surface switches positive on 'плюс'", () => {
  const source = "<h2>Плюс</h2>\n<hl>Good</hl>";
  const result = processHtml(source);
  assert.ok(result.includes('<bubble surface="positive">'));
});

test("hl keeps previous surface when header has no marker", () => {
  const source =
    "<h2>👍 Pros</h2>\n" +
    "<hl>First</hl>\n" +
    "<h2>Neutral header</h2>\n" +
    "<hl>Second</hl>";
  const result = processHtml(source);
  const matches = [...result.matchAll(/<bubble surface="(\w+)">/g)].map((m) => m[1]);
  assert.deepEqual(matches, ["positive", "positive"]);
});

test("hl negative surface persists across unmarked header", () => {
  const source =
    "<h2>👎 Cons</h2>\n" +
    "<hl>First</hl>\n" +
    "<h2>Neutral</h2>\n" +
    "<hl>Second</hl>";
  const result = processHtml(source);
  const matches = [...result.matchAll(/<bubble surface="(\w+)">/g)].map((m) => m[1]);
  assert.deepEqual(matches, ["negative", "negative"]);
});

test("empty hl produces empty bubble", () => {
  const source = "<h2>👍 Pros</h2>\n<hl>   \n </hl>";
  const result = processHtml(source);
  assert.ok(result.includes('<bubble surface="positive"></bubble>'));
});

test("hl content is trimmed and blank lines collapsed", () => {
  const source =
    "<h2>👍 Pros</h2>\n" +
    "<hl>\n  First line  \n\n   \n  Second line\n</hl>";
  const result = processHtml(source);
  assert.ok(result.includes("First line\n\nSecond line"));
  assert.ok(!result.includes("\n  First line  \n"));
});

test("multiple hl blocks each restored with correct surface", () => {
  const source =
    "<h2>👍 Pros</h2>\n" +
    "<hl>A</hl>\n" +
    "<h2>👎 Cons</h2>\n" +
    "<hl>B</hl>\n" +
    "<h2>👍 Pros again</h2>\n" +
    "<hl>C</hl>";
  const result = processHtml(source);
  const surfaces = [...result.matchAll(/<bubble surface="(\w+)">/g)].map((m) => m[1]);
  assert.deepEqual(surfaces, ["positive", "negative", "positive"]);
});

/* ------------------------------------------------------------------ */
/* processHtml: contents -> h2 ids                                     */
/* ------------------------------------------------------------------ */

test("contents matches h2 by text in order, skipping non-matching h2", () => {
  const source =
    "<contents>\n" +
    "    <li>{First}(#a)</li>\n" +
    "    <li>{Second}(#b)</li>\n" +
    "</contents>\n\n" +
    "<h2>First</h2>\n\n" +
    "<h2>Unrelated</h2>\n\n" +
    "<h2>Second</h2>";
  const result = processHtml(source);
  assert.ok(result.includes('<h2 id="one">First</h2>'));
  // Second toc entry matches the third h2 (index 2), gets id="two".
  assert.ok(result.includes('<h2 id="two">Second</h2>'));
  // Unrelated h2 stays without id (text-based matching, not fallback).
  assert.ok(!result.includes('<h2 id="one">Unrelated</h2>'));
  assert.ok(result.includes("<h2>Unrelated</h2>"));
});

test("contents entry with nested html in anchor is stripped for text matching", () => {
  const source =
    "<contents>\n" +
    "    <li>{<nobr>Могут ли</nobr> кофейные производители маскировать некачественное сырье?}(#three)</li>\n" +
    "</contents>\n\n" +
    "<h2><nobr>Могут ли</nobr> кофейные производители маскировать некачественное сырье?</h2>";
  const result = processHtml(source);
  assert.ok(result.includes('<h2 id="one">'));
});

test("contents fallback to anchors when h2 count exceeds toc entries", () => {
  const source =
    "<contents>\n" +
    "    <li>{Заголовок A}(#anchorA)</li>\n" +
    "</contents>\n\n" +
    "<h2>Разное A</h2>\n\n" +
    "<h2>Разное B</h2>";
  const result = processHtml(source);
  // Fallback: anchors assigned sequentially to the first h2 only (only one anchor).
  assert.ok(result.includes('<h2 id="anchorA">'));
  assert.ok(!result.includes('id="anchorB"'));
  assert.ok(result.includes("<h2>Разное B</h2>"));
});

test("contents with no entries leaves text unchanged", () => {
  const source = "<contents>\n</contents>\n\n<h2>Header</h2>";
  const result = processHtml(source);
  assert.ok(!result.includes('id="'));
  assert.ok(result.includes("<h2>Header</h2>"));
});

test("h2 id uses englishNumber for >20 headers", () => {
  const toc = [];
  const headers = [];
  for (let i = 1; i <= 21; i++) {
    toc.push(`    <li>{Заголовок ${i}}(#a${i})</li>`);
    headers.push(`<h2>Заголовок ${i}</h2>`);
  }
  const source = `<contents>\n${toc.join("\n")}\n</contents>\n\n${headers.join("\n\n")}`;
  const result = processHtml(source);
  assert.ok(result.includes('<h2 id="one">Заголовок 1</h2>'));
  assert.ok(result.includes('<h2 id="twenty">Заголовок 20</h2>'));
  // >20 falls back to numeric string
  assert.ok(result.includes('<h2 id="21">Заголовок 21</h2>'));
});

/* ------------------------------------------------------------------ */
/* processHtml: emoji replacement                                      */
/* ------------------------------------------------------------------ */

test("emoji plus with leading whitespace is replaced", () => {
  const source = "<h2>\n    ➕ Много плюсов\n</h2>";
  const result = processHtml(source);
  assert.ok(result.includes('<image src="plus-icon" />'));
  assert.ok(result.includes("Много плюсов"));
  assert.ok(!result.includes("➕"));
});

test("emoji minus with leading whitespace is replaced", () => {
  const source = "<h2>\n    ➖ Много минусов\n</h2>";
  const result = processHtml(source);
  assert.ok(result.includes('<image src="minus-icon" />'));
  assert.ok(!result.includes("➖"));
});

test("emoji in the middle of h2 is not replaced", () => {
  const source = "<h2>Заголовок ➕ не в начале</h2>";
  const result = processHtml(source);
  assert.ok(result.includes("➕"));
  assert.ok(!result.includes("<image"));
});

test("emoji plus alone (no trailing text) is not replaced", () => {
  const source = "<h2>➕</h2>";
  const result = processHtml(source);
  assert.ok(result.includes("➕"));
  assert.ok(!result.includes("<image"));
});

test("h2 with multiple emoji markers only first leading is replaced", () => {
  const source = "<h2>➕ ➕ Двойной плюс</h2>";
  const result = processHtml(source);
  assert.ok(result.includes('<image src="plus-icon" />'));
  assert.ok(result.includes("➕ Двойной плюс"));
});

/* ------------------------------------------------------------------ */
/* processHtml: spacing normalization                                  */
/* ------------------------------------------------------------------ */

test("three or more newlines collapse to two", () => {
  const source = "<p>a</p>\n\n\n\n\n<p>b</p>";
  const result = processHtml(source);
  assert.ok(!result.includes("\n\n\n"));
});

test("bubble followed by h2 gets two newlines", () => {
  const source =
    "<h2>👍 Pros</h2>\n" +
    "<hl>Text</hl>\n" +
    "<h2>Next</h2>";
  const result = processHtml(source);
  assert.ok(result.includes("</bubble>\n\n<h2>Next</h2>"));
});

test("author followed by h2 gets two newlines", () => {
  const source =
    "<p>{John Doe}(https://site.example/user7)</p>\n" +
    "<p>Bio</p>\n" +
    "<h2>Next</h2>";
  const result = processHtml(source);
  assert.ok(result.includes("</author>\n\n<h2>Next</h2>"));
});

test("h2 followed by author gets two newlines", () => {
  const source =
    "<h2>Header</h2>\n" +
    "<p>{John Doe}(https://site.example/user7)</p>\n" +
    "<p>Bio</p>";
  const result = processHtml(source);
  assert.ok(result.includes("</h2>\n\n<author"));
});

test("author-ugc (name-based) followed by h2 gets two newlines", () => {
  const source =
    "<p>John Doe</p>\n" +
    "<p>Bio</p>\n" +
    "<h2>Next</h2>";
  const result = processHtml(source);
  assert.ok(result.includes("</author-ugc>\n\n<h2>Next</h2>"));
});

test("h2 followed by author-ugc (name-based) gets two newlines", () => {
  const source =
    "<h2>Header</h2>\n" +
    "<p>John Doe</p>\n" +
    "<p>Bio</p>";
  const result = processHtml(source);
  assert.ok(result.includes("</h2>\n\n<author-ugc"));
});

test("h2 followed by paragraph gets two newlines", () => {
  const source = "<h2>Header</h2>\n<p>Paragraph</p>";
  const result = processHtml(source);
  assert.ok(result.includes("</h2>\n\n<p>Paragraph</p>"));
});

test("processHtml returns trimmed output", () => {
  const source = "\n\n  <p>{John Doe}(https://site.example/user7)</p>\n<p>Bio</p>  \n\n";
  const result = processHtml(source);
  assert.equal(result, result.trim());
  assert.ok(!result.startsWith("\n"));
  assert.ok(!result.endsWith("\n"));
});

/* ------------------------------------------------------------------ */
/* englishNumber                                                       */
/* ------------------------------------------------------------------ */

test("englishNumber maps 1..20 to words", () => {
  const expected = [
    "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
    "eighteen", "nineteen", "twenty",
  ];
  expected.forEach((word, index) => {
    assert.equal(englishNumber(index + 1), word);
  });
});

test("englishNumber returns numeric string above 20", () => {
  assert.equal(englishNumber(21), "21");
  assert.equal(englishNumber(100), "100");
});

test("englishNumber throws on non-positive input", () => {
  assert.throws(() => englishNumber(0), /Expected positive integer/);
  assert.throws(() => englishNumber(-5), /Expected positive integer/);
});

/* ------------------------------------------------------------------ */
/* stripHtmlTags                                                       */
/* ------------------------------------------------------------------ */

test("stripHtmlTags removes tags and collapses whitespace", () => {
  assert.equal(
    stripHtmlTags("<p>  Hello   <b>world</b>  </p>"),
    "Hello world"
  );
});

test("stripHtmlTags handles self-closing and empty content", () => {
  assert.equal(stripHtmlTags("<br/><img src='x'/>"), "");
  assert.equal(stripHtmlTags(""), "");
  assert.equal(stripHtmlTags("   "), "");
});

test("stripHtmlTags preserves text with no tags", () => {
  assert.equal(stripHtmlTags("plain text"), "plain text");
});

/* ------------------------------------------------------------------ */
/* assignContentIdsToHeaders (unit-level)                              */
/* ------------------------------------------------------------------ */

test("assignContentIdsToHeaders returns text when no contents block", () => {
  const source = "<h2>Header</h2>";
  assert.equal(assignContentIdsToHeaders(source), source);
});

test("assignContentIdsToHeaders returns text when no h2 present", () => {
  const source = "<contents><li>{Header}(#a)</li></contents>\n<p>No h2 here</p>";
  assert.equal(assignContentIdsToHeaders(source), source);
});

test("assignContentIdsToHeaders injects id before existing h2 attributes", () => {
  const source =
    "<contents><li>{Header}(#a)</li></contents>\n" +
    '<h2 class="special">Header</h2>';
  const result = assignContentIdsToHeaders(source);
  assert.ok(result.includes('<h2 id="one" class="special">Header</h2>'));
});

test("assignContentIdsToHeaders adds id even when h2 already has an id", () => {
  const source =
    "<contents><li>{Header}(#a)</li></contents>\n" +
    '<h2 id="existing">Header</h2>';
  const result = assignContentIdsToHeaders(source);
  // The id is injected as the first attribute; the original id remains.
  assert.ok(result.includes('<h2 id="one" id="existing">Header</h2>'));
});

/* ------------------------------------------------------------------ */
/* replaceEmojiInH2Headers (unit-level)                                */
/* ------------------------------------------------------------------ */

test("replaceEmojiInH2Headers leaves non-h2 text untouched", () => {
  const source = "<p>➕ not a header</p>";
  assert.equal(replaceEmojiInH2Headers(source), source);
});

test("replaceEmojiInH2Headers handles multiple h2 blocks", () => {
  const source = "<h2>➕ A</h2>\n<h2>➖ B</h2>";
  const result = replaceEmojiInH2Headers(source);
  assert.ok(result.includes('<image src="plus-icon" />'));
  assert.ok(result.includes('<image src="minus-icon" />'));
});

/* ------------------------------------------------------------------ */
/* isProbableAuthorName                                                */
/* ------------------------------------------------------------------ */

test("isProbableAuthorName accepts valid full names", () => {
  assert.equal(isProbableAuthorName("John Doe"), true);
  assert.equal(isProbableAuthorName("Ольга Карасева"), true);
  assert.equal(isProbableAuthorName("J"), true);
});

test("isProbableAuthorName rejects empty / whitespace", () => {
  assert.equal(isProbableAuthorName(""), false);
  assert.equal(isProbableAuthorName("   "), false);
  assert.equal(isProbableAuthorName(null), false);
  assert.equal(isProbableAuthorName(undefined), false);
});

test("isProbableAuthorName rejects trailing punctuation", () => {
  assert.equal(isProbableAuthorName("John."), false);
  assert.equal(isProbableAuthorName("John!"), false);
  assert.equal(isProbableAuthorName("John?"), false);
  assert.equal(isProbableAuthorName("John:"), false);
  assert.equal(isProbableAuthorName("John,"), false);
  assert.equal(isProbableAuthorName("John;"), false);
});

test("isProbableAuthorName rejects too many tokens", () => {
  assert.equal(isProbableAuthorName("A B C D E"), false);
});

test("isProbableAuthorName rejects lowercase first letter", () => {
  assert.equal(isProbableAuthorName("john doe"), false);
  assert.equal(isProbableAuthorName("John doe"), false);
});

test("isProbableAuthorName rejects names with invalid characters", () => {
  assert.equal(isProbableAuthorName("John 123"), false);
  assert.equal(isProbableAuthorName("John@Doe"), false);
});

test("isProbableAuthorName accepts hyphenated and apostrophe names", () => {
  assert.equal(isProbableAuthorName("Jean-Luc D'Arc"), true);
});