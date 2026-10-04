export type Cell = string | number | boolean | null | undefined;

const looksNumeric = /^[+-]?[\d\s()-]+$/; // phone numbers, plain numbers: can't run as a formula

function cell(value: Cell) {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // Spreadsheet formula injection: a text cell starting with = + - @ (or a
  // control char) can execute when opened in Excel/Sheets. Prefix with '.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s) && !looksNumeric.test(s)) {
    s = `'${s}`;
  }
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

// RFC 4180 rows, CRLF line endings, UTF-8 BOM so Excel reads non-Latin names.
export function toCsv(header: string[], rows: Cell[][]) {
  const lines = [header, ...rows].map((r) => r.map(cell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
