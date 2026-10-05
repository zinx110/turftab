"use client";

import { useState, useTransition } from "react";
import { createPlayer } from "@/app/(admin)/players/actions";
import { deleteGame, saveGame } from "@/app/(admin)/games/actions";
import { computeCharges, formatTaka } from "@/lib/money";
import { btn, btnDanger, btnGhost, card, input, muted } from "./ui";

type Player = { id: number; name: string };
type Pick = { guest: boolean; billedToId: number | null };
type Initial = {
  id?: number;
  playedOn: string;
  note: string;
  items: { label: string; amount: string }[];
  attendees: { playerId: number; guest: boolean; billedToId: number | null }[];
};

const modeOf = (p: Pick) => (p.guest ? "guest" : p.billedToId ? `cover:${p.billedToId}` : "own");

export function GameForm({ players: initialPlayers, initial }: { players: Player[]; initial: Initial }) {
  const [players, setPlayers] = useState(initialPlayers);
  const [playedOn, setPlayedOn] = useState(initial.playedOn);
  const [note, setNote] = useState(initial.note);
  const [items, setItems] = useState(initial.items);
  const [picks, setPicks] = useState<Record<number, Pick>>(
    Object.fromEntries(initial.attendees.map((a) => [a.playerId, { guest: a.guest, billedToId: a.billedToId }])),
  );
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const nameOf = new Map(players.map((p) => [p.id, p.name]));
  const selectedIds = players.filter((p) => p.id in picks).map((p) => p.id);

  const amounts = items.map((i) => Number(i.amount));
  const validItems = amounts.every((a) => Number.isInteger(a) && a > 0);
  const total = validItems ? amounts.reduce((s, a) => s + a, 0) : 0;

  let split: ReturnType<typeof computeCharges> | null = null;
  let problem: string | null = null;
  if (total > 0 && selectedIds.length > 0) {
    try {
      split = computeCharges(
        total,
        selectedIds.map((id) => ({ playerId: id, guest: picks[id].guest, billedToId: picks[id].billedToId })),
      );
    } catch (e) {
      problem = e instanceof RangeError ? e.message : "Check who played.";
    }
  }

  const toggle = (id: number) =>
    setPicks((prev) => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else next[id] = { guest: false, billedToId: null };
      return next;
    });

  const setMode = (id: number, value: string) =>
    setPicks((prev) => ({
      ...prev,
      [id]:
        value === "guest"
          ? { guest: true, billedToId: null }
          : value.startsWith("cover:")
            ? { guest: false, billedToId: Number(value.slice(6)) }
            : { guest: false, billedToId: null },
    }));

  const setItem = (index: number, patch: Partial<Initial["items"][number]>) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  function addPlayer() {
    const name = newName.trim();
    if (!name) return;
    start(async () => {
      const result = await createPlayer({ name });
      if (result.error || !result.player) return setError(result.error);
      const added = result.player;
      setPlayers((prev) => [...prev, added].sort((a, b) => a.name.localeCompare(b.name)));
      setPicks((prev) => ({ ...prev, [added.id]: { guest: false, billedToId: null } }));
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
        attendees: selectedIds.map((id) => ({ playerId: id, guest: picks[id].guest, billedToId: picks[id].billedToId })),
      });
      if (result?.error) setError(result.error); // success redirects
    });
  }

  const special = split?.lines.filter((l) => l.guest || l.billedToId) ?? [];

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
          <h2 className="font-medium">Who played ({selectedIds.length})</h2>
          <button
            type="button"
            className="text-sm underline"
            onClick={() =>
              setPicks(selectedIds.length ? {} : Object.fromEntries(players.map((p) => [p.id, { guest: false, billedToId: null }])))
            }
          >
            {selectedIds.length ? "Clear" : "Select all"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {players.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              aria-pressed={p.id in picks}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                p.id in picks ? "border-emerald-600 bg-emerald-600 text-white" : "border-black/15 dark:border-white/20"
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

      {selectedIds.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">Who pays for whom</h2>
          <p className={muted}>
            Normally everyone pays their own share. <b>Guest</b> plays free and the others split the cost.{" "}
            <b>Covered by</b> bills their share to another player, who doesn&apos;t have to be playing.
          </p>
          <ul className="flex flex-col gap-2">
            {selectedIds.map((id) => (
              <li key={id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">{nameOf.get(id)}</span>
                <select
                  value={modeOf(picks[id])}
                  onChange={(e) => setMode(id, e.target.value)}
                  className={`${input} max-w-56`}
                  aria-label={`How ${nameOf.get(id)} pays`}
                >
                  <option value="own">Pays own share</option>
                  <option value="guest">Guest (free)</option>
                  <optgroup label="Covered by…">
                    {players
                      .filter((p) => p.id !== id && !(p.id in picks && picks[p.id].guest))
                      .map((p) => (
                        <option key={p.id} value={`cover:${p.id}`}>
                          {p.name}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={`${card} sticky bottom-20 bg-background`}>
        {split ? (
          <>
            <p className="text-lg font-semibold">
              {split.headcount} {split.headcount === 1 ? "player" : "players"} → {formatTaka(split.perHead)} each
            </p>
            <p className={muted}>
              Total {formatTaka(total)}
              {split.surplus > 0 && ` · ${formatTaka(split.surplus)} over after rounding up`}
            </p>
            {special.length > 0 && (
              <ul className={`${muted} mt-1`}>
                {special.map((l) => (
                  <li key={l.playerId}>
                    {nameOf.get(l.playerId)}
                    {l.guest ? " · guest, free" : ` → billed to ${nameOf.get(l.billedToId!)}`}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : problem ? (
          <p role="alert" className="text-sm text-red-600">
            {problem}
          </p>
        ) : (
          <p className={muted}>Add costs and pick players to see the per-head amount.</p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <button type="submit" disabled={pending || !split} className={`${btn} mt-3 w-full`}>
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
