"use strict";

// Builds tiny but structurally valid OOXML packages using our stored-entry
// ZIP writer. These are fixtures for parser tests - not authored documents.

const {buildZip} = require("../../../agent/zip");

function xml(name, body) {
  return {name, data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${body}`};
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, char => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"}[char]));
}

function contentTypesXml() {
  return xml("[Content_Types].xml", `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>`);
}

function buildDocx({paragraphs, table}) {
  const body = [];
  for (const paragraph of paragraphs) {
    const style = paragraph.style ? `<w:pPr><w:pStyle w:val="${paragraph.style}"/></w:pPr>` : "";
    body.push(`<w:p>${style}<w:r><w:t>${escapeXml(paragraph.text)}</w:t></w:r></w:p>`);
  }
  if (table) {
    const rows = [table.columns, ...table.rows].map(row =>
      `<w:tr>${row.map(cell => `<w:tc><w:p><w:r><w:t>${escapeXml(cell)}</w:t></w:r></w:p></w:tc>`).join("")}</w:tr>`
    ).join("");
    body.push(`<w:tbl>${rows}</w:tbl>`);
  }
  return buildZip([
    contentTypesXml(),
    xml("_rels/.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`),
    xml("word/document.xml", `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join("")}</w:body></w:document>`),
  ]);
}

function buildXlsx({sheets}) {
  const sheetEntries = [];
  const sheetMetas = [];
  sheets.forEach((sheet, index) => {
    const name = `sheet${index + 1}`;
    const rows = [sheet.columns, ...sheet.rows].map((row, rowIndex) =>
      `<row r="${rowIndex + 1}">${row.map((cell, cellIndex) => {
        const reference = `${String.fromCharCode(65 + cellIndex)}${rowIndex + 1}`;
        return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`;
      }).join("")}</row>`
    ).join("");
    sheetEntries.push(xml(`xl/worksheets/${name}.xml`, `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`));
    sheetMetas.push(`<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`);
  });
  const rels = sheetMetas.map((meta, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  return buildZip([
    contentTypesXml(),
    xml("_rels/.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    xml("xl/workbook.xml", `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetMetas.join("")}</sheets></workbook>`),
    xml("xl/_rels/workbook.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`),
    ...sheetEntries,
  ]);
}

function buildPptx({slides}) {
  const slideEntries = slides.map((slide, index) => xml(`ppt/slides/slide${index + 1}.xml`,
    `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree>${slide.map(text =>
      `<p:sp><p:txBody><a:p><a:r><a:t>${escapeXml(text)}</a:t></a:r></a:p></p:txBody></p:sp>`
    ).join("")}</p:spTree></p:cSld></p:sld>`
  ));
  return buildZip([
    contentTypesXml(),
    xml("_rels/.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`),
    xml("ppt/presentation.xml", `<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`),
    ...slideEntries,
  ]);
}

module.exports = {buildDocx, buildXlsx, buildPptx};
