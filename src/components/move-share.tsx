"use client";

import { useState, useTransition } from "react";
import { moveShare } from "@/app/(admin)/games/actions";
import { btn, btnGhost } from "./ui";

// Moves one person's share of one game to another player ("B will cover
// mine"), or back to the person themselves. Only rendered for unpaid shares.
export function MoveShare({
  gameId,
  forId,
  forName,
  options,
  canReset,
  label = "Move",
}: {
  gameId: number;
  forId: number;
  forName: string;
  options: { id: number; name: string }[];
  canReset: boolean; // true when the share is currently billed to someone else
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function submit() {
    if (!choice) return;
    start(async () => {
      const r = await moveShare(gameId, forId, choice === "self" ? null : Number(choice));
      setError(r.error);
      if (!r.error) {
        setOpen(false);
        setChoice("");
      }
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm underline">
        {label}
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 pt-1">
      <div className="flex gap-2">
        <select
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-base dark:border-white/20"
          aria-label={`Who pays ${forName}'s share`}
          autoFocus
        >
          <option value="">Bill to…</option>
          {canReset && <option value="self">Back to {forName}</option>}
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={submit} disabled={pending || !choice} className={btn}>
          {pending ? "Moving…" : "Move"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
