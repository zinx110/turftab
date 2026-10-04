"use client";

import { useState, useTransition } from "react";
import { createPlayer } from "@/app/(admin)/players/actions";
import { deleteGame, saveGame } from "@/app/(admin)/games/actions";
import { formatTaka, perHeadCharge, surplus } from "@/lib/money";
import { btn, btnDanger, btnGhost, card, input, muted } from "./ui";

type Player = { id: number; name: string };
type Initial = {
  id?: number;
  playedOn: string;
  note: string;
  items: { label: string; amount: string }[];
  playerIds: number[];
};

export function GameForm({ players: initialPlayers, initial }: { players: Player[]; initial: Initial }) {
  const [players, setPlayers] = useState(initialPlayers);
  const [playedOn, setPlayedOn] = useState(initial.playedOn);
  const [note, setNote] = useState(initial.note);
  const [items, setItems] = useState(initial.items);
  const [selected, setSelected] = useState(new Set(initial.playerIds));
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const amounts = items.map((i) => Number(i.amount));
  const valid = amounts.every((a) => Number.isInteger(a) && a > 0);
  const total = valid ? amounts.reduce((s, a) => s + a, 0) : 0;
  const count = selected.size;
  const canPreview = valid && total > 0 && count > 0;

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const setItem = (index: number, patch: Partial<Initial["items"][number]>) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  function addPlayer() {
    const name = newName.trim();
    if (!name) return;
    start(async () => {
      const result = await createPlayer({ name });
      if (result.error || !result.player) return setError(result.error);
      setPlayers((prev) => [...prev, result.player].sort((a, b) => a.name.localeCompare(b.name)));
      setSelected((prev) => new Set(prev).add(result.player.id));
      setNewName("");
      setError(undefined);
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const result = await saveGame({
        id: initial.id,
        playedOn,
        note,
        items: items.map((i) => ({ label: i.label, amount: Number(i.amount) })),
        playerIds: [...selected],
      });
      if (result?.error) setError(result.error); // success redirects
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <label className="font-medium" htmlFor="playedOn">
          Date
        </label>
        <input id="playedOn" type="date" required value={playedOn} onChange={(e) => setPlayedOn(e.target.value)} className={input} />
        <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} className={input} maxLength={200} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Costs</h2>
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              placeholder="Turf, drinks, vest washing…"
              value={item.label}
              onChange={(e) => setItem(i, { label: e.target.value })}
              className={input}
              maxLength={60}
              required
            />
            <input
              placeholder="৳"
              inputMode="numeric"
              value={item.amount}
              onChange={(e) => setItem(i, { amount: e.target.value.replace(/\D/g, "") })}
              className={`${input} max-w-28`}
              required
            />
            {items.length > 1 && (
              <button type="button" aria-label="Remove cost" onClick={() => setItems((p) => p.filter((_, j) => j !== i))} className={btnGhost}>
                ✕
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setItems((p) => [...p, { label: "", amount: "" }])} className={`${btnGhost} self-start`}>
          + Add cost
        </button>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Who played ({count})</h2>
          <button type="button" className="text-sm underline" onClick={() => setSelected(selected.size ? new Set() : new Set(players.map((p) => p.id)))}>
            {selected.size ? "Clear" : "Select all"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {players.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              aria-pressed={selected.has(p.id)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                selected.has(p.id)
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-black/15 dark:border-white/20"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input placeholder="New player name" value={newName} onChange={(e) => setNewName(e.target.value)} className={input} maxLength={60} />
          <button type="button" onClick={addPlayer} disabled={pending || !newName.trim()} className={btnGhost}>
            Add
          </button>
        </div>
      </section>

      <section className={`${card} sticky bottom-20 bg-background`}>
        {canPreview ? (
          <>
            <p className="text-lg font-semibold">
              {count} {count === 1 ? "player" : "players"} → {formatTaka(perHeadCharge(total, count))} each
            </p>
            <p className={muted}>
              Total {formatTaka(total)}
              {surplus(total, count) > 0 && ` · ${formatTaka(surplus(total, count))} over after rounding up`}
            </p>
          </>
        ) : (
          <p className={muted}>Add costs and pick players to see the per-head amount.</p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <button type="submit" disabled={pending || !canPreview} className={`${btn} mt-3 w-full`}>
          {pending ? "Saving…" : initial.id ? "Save changes" : "Save game"}
        </button>
        {initial.id && <p className={`${muted} mt-2`}>Saving recalculates everyone&apos;s charge for this game.</p>}
      </section>

      {initial.id && (
        <button
          type="button"
          disabled={pending}
          className={`${btnDanger} self-start`}
          onClick={() => {
            if (confirm("Delete this game? Players' balances will drop by their charge.")) {
              start(async () => {
                await deleteGame(initial.id!);
              });
            }
          }}
        >
          Delete game
        </button>
      )}
    </form>
  );
}
