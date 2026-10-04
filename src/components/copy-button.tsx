"use client";

import { useState } from "react";
import { btnGhost } from "./ui";

// `text` may contain "{origin}", filled in with this site's address in the
// browser, so server code never has to know the deployed URL.
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text.replaceAll("{origin}", window.location.origin));
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      window.prompt("Copy this:", text.replaceAll("{origin}", window.location.origin));
    }
  }

  return (
    <button type="button" onClick={copy} className={btnGhost}>
      {done ? "Copied" : label}
    </button>
  );
}
