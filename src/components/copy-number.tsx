"use client";

import { useState } from "react";

// Copies a phone/bKash number, with a visible "Copied" confirmation.
export function CopyNumber({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      window.prompt("Copy this number:", value);
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-xl bg-white/20 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/30 active:scale-[0.97]"
    >
      {done ? "Copied ✓" : "Copy"}
    </button>
  );
}
