import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

const body = (csv: string) => csv.replace(/^﻿/, "");

describe("toCsv", () => {
  it("writes a header, rows, CRLF endings and a BOM", () => {
    const csv = toCsv(["a", "b"], [[1, "x"], [2, "y"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(body(csv)).toBe("a,b\r\n1,x\r\n2,y\r\n");
  });

  it("quotes commas, quotes and newlines, escaping inner quotes", () => {
    expect(body(toCsv(["n"], [["Rahim, Jr."], ['say "hi"'], ["two\nlines"]]))).toBe(
      'n\r\n"Rahim, Jr."\r\n"say ""hi"""\r\n"two\nlines"\r\n',
    );
  });

  it("renders null/undefined as empty and keeps booleans", () => {
    expect(body(toCsv(["a", "b", "c"], [[null, undefined, true]]))).toBe("a,b,c\r\n,,true\r\n");
  });

  it("neutralises formula injection in text", () => {
    expect(body(toCsv(["n"], [["=HYPERLINK(\"http://x\")"], ["@SUM(A1)"], ["-cmd|' /C calc'!A0"]]))).toBe(
      "n\r\n\"'=HYPERLINK(\"\"http://x\"\")\"\r\n'@SUM(A1)\r\n'-cmd|' /C calc'!A0\r\n",
    );
  });

  it("leaves real numbers (even negative) and phone numbers alone", () => {
    expect(body(toCsv(["n", "p"], [[-50, "+880 1712-345678"]]))).toBe("n,p\r\n-50,+880 1712-345678\r\n");
  });

  it("keeps non-Latin names intact", () => {
    expect(body(toCsv(["n"], [["রহিম"]]))).toBe("n\r\nরহিম\r\n");
  });
});
