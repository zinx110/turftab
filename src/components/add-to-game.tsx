"use client";

import { useState, useTransition } from "react";
import { addPlayerToGame } from "@/app/(admin)/games/actions";
import { createPlayer } from "@/app/(admin)/players/actions";
import { formatTaka, perHeadCharge } from "@/lib/money";
import { btn, btnGhost, card, input, muted } from "./ui";

// Adds a late arrival to a game that's already saved. Adding a paying player
// shrinks everyone's share, so the new amount is shown before you confirm.
export function AddToGame({
  gameId,
  candidates,
  total,
  headcount,
  anyPaid,
}: {
  gameId: number;
  candidates: { id: number; name: string }[];
  total: number;
  headcount: number;
  anyPaid: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState("");
  const [newName, setNewName] = useState("");
  const [guest, setGuest] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const nowEach = headcount ? perHeadCharge(total, headcount) : 0;
  const newCount = guest ? headcount : headcount + 1;
  const afterEach = newCount ? perHeadCharge(total, newCount) : 0;
  const ready = choice !== "" || newName.trim() !== "";

  function submit() {
    start(async () => {
      let playerId = Number(choice);
      if (choice === "") {
        const made = await createPlayer({ name: newName });
        if (made.error || !made.player) return setError(made.error);
        playerId = made.player.id;
      }
      const r = await addPlayerToGame(gameId, playerId, guest ? "guest" : "own");
      if (r.error) return setError(r.error);
      setOpen(false);
      setChoice("");
      setNewName("");
      setGuest(false);
      setError(undefined);
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${btnGhost} self-start`}>
        + Add a player
      </button>
    );
  }

  return (
    <div className={`${card} flex flex-col gap-3`}>
      <p className="font-semibold">Add a player to this game</p>

      <select
        value={choice}
        onChange={(e) => { setChoice(e.target.value); if (e.target.value) setNewName(""); }}
        className={input}
        aria-label="Existing player"
      >
        <option value="">Pick a player…</option>
        {candidates.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input
        value={newName}
        onChange={(e) => { setNewName(e.target.value); if (e.target.value) setChoice(""); }}
        placeholder="…or type a new player's name"
        maxLength={60}
        className={input}
      />

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={guest} onChange={(e) => setGuest(e.target.checked)} className="size-4 accent-emerald-600" />
        Guest (plays free, others split the cost)
      </label>

      {ready && (
        <div className="rounded-xl bg-subtle p-3 text-sm">
          {guest ? (
            <p>Nobody&apos;s share changes. They just join a team.</p>
          ) : (
            <p>
              Everyone&apos;s share changes: <b>{headcount} → {newCount} paying</b>,{" "}
              <b>{formatTaka(nowEach)} → {formatTaka(afterEach)}</b> each.
            </p>
          )}
          {!guest && anyPaid && (
            <p className="mt-1 text-amber-700 dark:text-amber-400">
              Some people have already paid the old amount. They&apos;ll show as being ahead by the difference.
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
          Cancel
        </button>
        <button type="button" onClick={submit} disabled={pending || !ready} className={btn}>
          {pending ? "Adding…" : "Add to game"}
        </button>
      </div>
      <p className={muted}>They join the smaller team, and you can move them from there.</p>
    </div>
  );
}
