"use strict";

// Deterministic office/text parsers. Every parser returns plain fragments;
// evidenceId assignment and corpus assembly live in parse.js so id policy
// stays in one place. No model calls allowed in this layer.

const {readZip} = require("./zip");

const ENTITIES = {amp: "&", lt: "<", gt: ">", quot: '"', apos: "'"};

function xmlText(value) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
      if (entity[0] === "#") {
        const code = entity[1] === "x" || entity[1] === "X" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return ENTITIES[entity] || match;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function tagTexts(xml, tag) {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g");
  const result = [];
  for (const match of xml.matchAll(pattern)) result.push(xmlText(match[1]));
  return result;
}

function parseDocx(buffer) {
  const files = readZip(buffer);
  const document = files.get("word/document.xml");
  if (!document) throw new Error("docx missing word/document.xml");
  const xml = document.toString("utf8");
  const body = xml.match(/<w:body>([\s\S]*)<\/w:body>/)?.[1] ?? xml;
  const fragments = [];
  let tableIndex = 0;
  const blockPattern = /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
  for (const block of body.matchAll(blockPattern)) {
    if (block[0].startsWith("<w:tbl>")) {
      tableIndex += 1;
      const rows = [...block[0].matchAll(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g)].map(row =>
        [...row[0].matchAll(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g)].map(cell => tagTexts(cell[0], "w:t").join(""))
      );
      if (!rows.length) continue;
      const columns = rows[0];
      fragments.push({
        fragmentType: "table",
        text: `表${tableIndex}：${rows.map(row => row.join(" / ")).join("；")}`,
        table: {name: `表${tableIndex}`, columns, rows: rows.slice(1)},
        locator: {row: 1},
      });
      continue;
    }
    const text = tagTexts(block[0], "w:t").join("");
    if (!text) continue;
    const heading = block[0].match(/<w:pStyle[^>]*w:val="(?:Heading([1-6])|标题\s*([1-6]))"/);
    fragments.push({
      fragmentType: heading ? "heading" : "paragraph",
      text,
      locator: {paragraph: fragments.length + 1},
    });
  }
  return fragments;
}

function columnLettersToIndex(reference) {
  const letters = reference.replace(/[0-9]/g, "");
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

function parseXlsx(buffer) {
  const files = readZip(buffer);
  const shared = tagTexts(files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "", "t");
  const workbook = files.get("xl/workbook.xml")?.toString("utf8");
  if (!workbook) throw new Error("xlsx missing xl/workbook.xml");
  const relsXml = files.get("xl/_rels/workbook.xml.rels")?.toString("utf8") ?? "";
  const rels = new Map([...relsXml.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)]
    .map(match => [match[1], match[2].replace(/^\//, "")]));
  const fragments = [];
  for (const sheet of workbook.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    const name = xmlText(sheet[1]);
    const target = rels.get(sheet[2]);
    const path = target?.startsWith("xl/") ? target : `xl/${target}`;
    const xml = files.get(path)?.toString("utf8");
    if (!xml) continue;
    const rows = [];
    for (const row of xml.matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g)) {
      const cells = [];
      for (const cell of row[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
        const attributes = cell[1];
        const content = cell[2];
        const reference = attributes.match(/r="([A-Z]+)[0-9]+"/)?.[1] ?? "";
        const index = Math.max(0, columnLettersToIndex(reference || String.fromCharCode(65 + cells.length)));
        let value = "";
        if (attributes.includes('t="inlineStr"')) value = tagTexts(content, "t").join("");
        else if (attributes.includes('t="s"')) value = shared[Number(content.match(/<v>([^<]*)<\/v>/)?.[1] ?? -1)] ?? "";
        else value = xmlText(content.match(/<v>([^<]*)<\/v>/)?.[1] ?? "");
        while (cells.length < index) cells.push("");
        cells[index] = value;
      }
      if (cells.length) rows.push(cells);
    }
    if (!rows.length) continue;
    fragments.push({
      fragmentType: "sheet",
      text: `${name}：${rows.map(row => row.join(" / ")).join("；")}`,
      table: {name, columns: rows[0], rows: rows.slice(1)},
      locator: {sheet: name, row: 1},
    });
  }
  return fragments;
}

function parsePptx(buffer) {
  const files = readZip(buffer);
  const slides = [...files.keys()]
    .filter(name => /^ppt\/slides\/slide([0-9]+)\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/slide([0-9]+)/)[1]) - Number(b.match(/slide([0-9]+)/)[1]));
  const fragments = [];
  for (const name of slides) {
    const xml = files.get(name).toString("utf8");
    const texts = tagTexts(xml, "a:t").filter(Boolean);
    if (!texts.length) continue;
    const slideNumber = Number(name.match(/slide([0-9]+)/)[1]);
    fragments.push({
      fragmentType: "slide",
      text: texts.join("；"),
      slide: {slideNumber, title: texts[0]},
      locator: {page: slideNumber},
    });
  }
  return fragments;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(value.trim());
      value = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value.trim());
      if (row.some(cell => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else value += char;
  }
  row.push(value.trim());
  if (row.some(cell => cell !== "")) rows.push(row);
  if (!rows.length) return [];
  return [{
    fragmentType: "table",
    text: `CSV：${rows.map(cells => cells.join(" / ")).join("；")}`,
    table: {name: "CSV", columns: rows[0], rows: rows.slice(1)},
    locator: {row: 1},
  }];
}

function parseMarkdown(text) {
  const lines = text.split(/\r?\n/);
  const fragments = [];
  let paragraph = [];
  const flushParagraph = () => {
    if (!paragraph.length) return;
    fragments.push({fragmentType: "paragraph", text: paragraph.join(" "), locator: {paragraph: fragments.length + 1}});
    paragraph = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      continue;
    }
    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      fragments.push({fragmentType: "heading", text: heading[2].trim(), locator: {paragraph: fragments.length + 1}});
      continue;
    }
    if (/^[-*+]\s+/.test(trimmed)) {
      flushParagraph();
      fragments.push({fragmentType: "list", text: trimmed.replace(/^[-*+]\s+/, ""), locator: {paragraph: fragments.length + 1}});
      continue;
    }
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushParagraph();
      const cells = trimmed.slice(1, -1).split("|").map(cell => cell.trim());
      if (cells.every(cell => /^:?-{2,}:?$/.test(cell))) continue;
      const previous = fragments[fragments.length - 1];
      if (previous?.fragmentType === "table" && previous.table) {
        previous.table.rows.push(cells);
        previous.text = `${previous.table.name}：${[previous.table.columns, ...previous.table.rows].map(row => row.join(" / ")).join("；")}`;
      } else {
        fragments.push({
          fragmentType: "table",
          text: `表1：${cells.join(" / ")}`,
          table: {name: "表1", columns: cells, rows: []},
          locator: {row: 1},
        });
      }
      continue;
    }
    paragraph.push(trimmed);
  }
  flushParagraph();
  return fragments;
}

function parserFor(fileName, mimeType) {
  const extension = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  const officeTypes = new Map([
    ["docx", parseDocx],
    ["xlsx", parseXlsx],
    ["pptx", parsePptx],
    ["csv", buffer => parseCsv(buffer.toString("utf8"))],
    ["md", buffer => parseMarkdown(buffer.toString("utf8"))],
    ["txt", buffer => parseMarkdown(buffer.toString("utf8"))],
  ]);
  if (officeTypes.has(extension)) return {parse: officeTypes.get(extension), mediaType: extension};
  if (mimeType === "text/csv") return {parse: officeTypes.get("csv"), mediaType: "csv"};
  if (mimeType === "text/markdown" || mimeType === "text/plain") return {parse: officeTypes.get("md"), mediaType: "md"};
  return null;
}

module.exports = {parseDocx, parseXlsx, parsePptx, parseCsv, parseMarkdown, parserFor, xmlText};
