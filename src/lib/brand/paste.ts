/**
 * Pasting into the Broadcast rows, the way env editors split KEY=value:
 * copy Name and Number columns from Excel / Google Sheets (tab-separated),
 * or lines like "Rahul, 9876543210" or "9876543210 Rahul", and every line
 * lands in its own row with the name and number in the right boxes.
 */

export type PastedRow = { name?: string; number?: string };

/** 10+ digits, allowing + spaces dashes dots and brackets between them. */
const PHONE = /\+?\d[\d\s\-().]{8,}\d/;
const isPhone = (cell: string) => {
  const digits = cell.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 && /^[\d\s+\-().]+$/.test(cell.trim());
};
const HEADER = /\b(name|number|phone|mobile|contact|whatsapp)\b/i;
const clean = (s: string) => s.replace(/^[\s,;:|\-–]+|[\s,;:|\-–]+$/g, "").replace(/\s+/g, " ");

function splitLine(line: string): PastedRow {
  // Spreadsheet cells: the phone cell, and the first cell with letters is the name
  // (so a serial-number or city column next to them is ignored).
  if (line.includes("\t")) {
    const cells = line.split("\t").map((c) => c.trim());
    const phoneAt = cells.findIndex(isPhone);
    const name = cells.find((c, i) => i !== phoneAt && /\p{L}/u.test(c));
    return { ...(name && { name: clean(name) }), ...(phoneAt >= 0 && { number: cells[phoneAt] }) };
  }
  // Free text: the phone-looking part is the number, the rest is the name.
  const match = line.match(PHONE);
  if (!match) return { name: clean(line) };
  const name = clean(line.replace(match[0], " "));
  return { ...(name && { name }), number: match[0].trim() };
}

/**
 * Rows for a paste, or null to let the browser paste normally (one plain
 * value typed into one box). `field` is the box pasted into: a single column
 * goes down that column, unless it is clearly the other kind (numbers pasted
 * under Name still go to Number).
 */
export function parsePaste(text: string, field: "name" | "number"): PastedRow[] | null {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const single = lines.length === 1;
  if (single && !lines[0].includes("\t")) {
    // "Rahul 9876543210" in one go is a row; a lone name or number is a normal paste.
    const row = splitLine(lines[0]);
    return row.name && row.number ? [row] : null;
  }
  if (!PHONE.test(lines[0]) && HEADER.test(lines[0]) && lines.length > 1) lines.shift();

  return lines.map((line) => {
    const row = splitLine(line);
    if (row.name && row.number) return row;
    if (row.number) return { number: row.number };
    // No phone on this line: it belongs to the box pasted into.
    return field === "name" ? { name: row.name } : { number: line };
  });
}

/** Writes pasted rows over the form from row `start` down, adding rows as needed. */
export function applyPaste<T extends { name: string; number: string }>(rows: T[], start: number, pasted: PastedRow[]): T[] {
  const next = [...rows];
  pasted.forEach((p, k) => {
    const i = start + k;
    const current = next[i] ?? ({ name: "", number: "" } as T);
    next[i] = { ...current, ...(p.name !== undefined && { name: p.name }), ...(p.number !== undefined && { number: p.number }) };
  });
  return next;
}
