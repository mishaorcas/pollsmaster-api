import { test } from "node:test";
import assert from "node:assert/strict";
import { processHtml } from "../js/html_processor.js";

test("author with link is converted", () => {
  const source = "<p>{John Doe}(https://site.example/user77)</p>\n<p>Short bio</p>";
  const result = processHtml(source);
  assert.ok(result.includes('social_id="77"'));
  assert.ok(result.includes("<author prop="));
  assert.ok(result.includes("</author>"));
  assert.ok(result.includes("<description>Short bio</description>"));
});

test("plain name is converted", () => {
  const source = "<p>John Doe</p>\n<p>Author description</p>";
  const result = processHtml(source);
  assert.ok(result.includes('<author-ugc name="John Doe"'));
});

test("regular paragraph pair is not converted", () => {
  const source = "<p>First paragraph</p>\n<p>Second paragraph</p>";
  const result = processHtml(source);
  assert.ok(!result.includes("<author-ugc"));
  assert.ok(result.includes("<p>First paragraph</p>"));
});

test("hl surface switches by header", () => {
  const source =
    "<h2>\u{1F44D} Pros</h2>\n" +
    "<hl>A\nB</hl>\n" +
    "<h2>\u{1F44E} Cons</h2>\n" +
    "<hl>C</hl>";
  const result = processHtml(source);
  assert.ok(result.includes('<bubble surface="positive">'));
  assert.ok(result.includes('<bubble surface="negative">'));
});

test("link without user id is not converted", () => {
  const source = "<p>{John Doe}(https://site.example/profile)</p>\n<p>Bio</p>";
  const result = processHtml(source);
  assert.ok(!result.includes("<author-ugc"));
});

test("primary author before lead is converted to author", () => {
  const source =
    "<p>За и против: <span>стоит&nbsp;ли</span> поддерживать связь с бывшими одноклассниками</p>\n\n" +
    "<p>Аргументы читателей</p>\n\n" +
    "<p>{Ольга Карасева}(https://t-j.ru/user2111814)</p>\n\n" +
    "<p>выслушала обе стороны</p>\n\n" +
    "<lead><nobr>Кто-то</nobr> после окончания школы остается на связи с бывшими " +
    "одноклассниками, а <nobr>кто-то</nobr> принципиально их избегает.</lead>";
  const result = processHtml(source);
  assert.ok(result.includes("<author>"));
  assert.ok(result.includes("<description>выслушала обе стороны</description>"));
  assert.ok(!result.includes("{Ольга Карасева}"));
  assert.ok(!result.split("<lead>")[0].includes("<author-ugc"));
  assert.ok(result.includes("<lead><nobr>Кто-то</nobr>"));
  assert.ok(result.startsWith("<author>"));
});

test("existing empty author is filled", () => {
  const source =
    "<author>\n" +
    "    <description></description>\n" +
    "</author>\n\n" +
    "<p>{Ольга Карасева}(https://t-j.ru/user2111814)</p>\n" +
    "<p>выслушала обе стороны</p>\n" +
    "<lead>Текст лида</lead>";
  const result = processHtml(source);
  assert.equal(result.split("<author>").length - 1, 1);
  assert.ok(result.includes("<description>выслушала обе стороны</description>"));
  assert.ok(!result.includes("<description></description>"));
  assert.ok(!result.includes("{Ольга Карасева}"));
});

test("empty author without data is removed", () => {
  const source =
    "<author>\n" +
    "    <description></description>\n" +
    "</author>\n\n" +
    "<p>Просто текст</p>";
  const result = processHtml(source);
  assert.ok(!result.includes("<author>"));
  assert.ok(result.includes("<p>Просто текст</p>"));
});

test("contents assigns ids to h2 headers", () => {
  const source =
    "<contents-title>О чем поговорим</contents-title>\n" +
    "<contents>\n" +
    "    <li>{Как понять, что кофе действительно хороший и качественный?}(#one)</li>\n" +
    "    <li>{Как отличить арабику от робусты?}(#two)</li>\n" +
    "    <li>{<nobr>Могут ли</nobr> кофейные производители маскировать некачественное сырье?}(#three)</li>\n" +
    "</contents>\n\n" +
    "<h2>Как понять, что кофе действительно хороший и качественный?</h2>\n\n" +
    "<h2>Как отличить арабику от робусты?</h2>\n\n" +
    "<h2><nobr>Могут ли</nobr> кофейные производители маскировать некачественное сырье?</h2>";
  const result = processHtml(source);
  assert.ok(result.includes('id="one"'));
  assert.ok(result.includes('id="two"'));
  assert.ok(result.includes('id="three"'));
  assert.ok(result.includes('<h2 id="one">Как понять'));
  assert.ok(result.includes('<h2 id="two">Как отличить'));
  assert.ok(result.includes('<h2 id="three"><nobr>Могут ли</nobr>'));
  assert.ok(result.includes("<contents>"));
  assert.ok(result.includes("</contents>"));
});

test("contents without contents block is unchanged", () => {
  const source = "<h2>Без оглавления</h2>";
  const result = processHtml(source);
  assert.ok(!result.includes('id="'));
  assert.ok(result.includes("<h2>Без оглавления</h2>"));
});

test("contents with many headers", () => {
  const source =
    "<contents>\n" +
    "    <li>{Первый заголовок}(#a)</li>\n" +
    "    <li>{Второй заголовок}(#b)</li>\n" +
    "    <li>{Третий заголовок}(#c)</li>\n" +
    "    <li>{Четвёртый заголовок}(#d)</li>\n" +
    "    <li>{Пятый заголовок}(#e)</li>\n" +
    "</contents>\n\n" +
    "<h2>Первый заголовок</h2>\n\n" +
    "<h2>Второй заголовок</h2>\n\n" +
    "<h2>Третий заголовок</h2>\n\n" +
    "<h2>Четвёртый заголовок</h2>\n\n" +
    "<h2>Пятый заголовок</h2>";
  const result = processHtml(source);
  assert.ok(result.includes('id="one"'));
  assert.ok(result.includes('id="two"'));
  assert.ok(result.includes('id="three"'));
  assert.ok(result.includes('id="four"'));
  assert.ok(result.includes('id="five"'));
});

test("contents preserves existing h2 attributes", () => {
  const source =
    "<contents>\n" +
    "    <li>{Заголовок}(#x)</li>\n" +
    "</contents>\n\n" +
    '<h2 class="special">Заголовок</h2>';
  const result = processHtml(source);
  assert.ok(result.includes('id="one"'));
  assert.ok(result.includes('class="special"'));
});

test("contents fallback to anchors when texts don't match", () => {
  const source =
    "<contents-title>Отзывы туристов о Вьетнаме</contents-title>\n" +
    "<contents>\n" +
    "    <li>{Отзыв № 1: низкие цены}(#one)</li>\n" +
    "    <li>{Отзыв № 2: комфортное автобусное сообщение }(#two)</li>\n" +
    "    <li>{Отзыв № 3: толпы российских туристов}(#three)</li>\n" +
    "</contents>\n\n" +
    "<h2>\n" +
    '    <label position="top">Отзыв № 1</label>\n' +
    "    👍 «Цены очень адекватные даже в приличных заведениях»\n" +
    "</h2>\n\n" +
    "<h2>\n" +
    '    <label position="top">Отзыв № 2</label>\n' +
    "    👍 «Считаю Вьетнам лучшей страной региона»\n" +
    "</h2>\n\n" +
    "<h2>\n" +
    '    <label position="top">Отзыв № 3</label>\n' +
    "    🤏 «Несносно много туристов из России»\n" +
    "</h2>";
  const result = processHtml(source);
  assert.ok(result.includes('id="one"'));
  assert.ok(result.includes('id="two"'));
  assert.ok(result.includes('id="three"'));
  assert.ok(result.includes('<h2 id="one">'));
  assert.ok(result.includes('<h2 id="two">'));
  assert.ok(result.includes('<h2 id="three">'));
  assert.ok(result.includes("<contents>"));
  assert.ok(result.includes("</contents>"));
});

test("emoji plus replaced with image tag", () => {
  const source = "<h2>\u2795 Хорошее оснащение и множество модификаций</h2>";
  const result = processHtml(source);
  assert.ok(result.includes('<image src="plus-icon" />'));
  assert.ok(result.includes("Хорошее оснащение и множество модификаций"));
  assert.ok(!result.includes("\u2795"));
});

test("emoji minus replaced with image tag", () => {
  const source = "<h2>\u2796 Хорошее оснащение и множество модификаций</h2>";
  const result = processHtml(source);
  assert.ok(result.includes('<image src="minus-icon" />'));
  assert.ok(result.includes("Хорошее оснащение и множество модификаций"));
  assert.ok(!result.includes("\u2796"));
});

test("h2 without emoji unchanged", () => {
  const source = "<h2>Просто заголовок</h2>";
  const result = processHtml(source);
  assert.ok(!result.includes("<image"));
  assert.ok(result.includes("<h2>Просто заголовок</h2>"));
});