"use client";

import { useState, useTransition } from "react";
import { saveScore, setTeam, shuffleTeams } from "@/app/(admin)/games/actions";
import { Avatar } from "./avatar";
import { ConfirmButton } from "./confirm-button";
import { btn, btnGhost, card, input, muted, pill, sectionTitle } from "./ui";

type Member = { id: number; name: string; guest: boolean; team: "A" | "B" | null };

const style = {
  A: { name: "Team A", bar: "bg-emerald-600", text: "text-emerald-700 dark:text-emerald-400" },
  B: { name: "Team B", bar: "bg-sky-600", text: "text-sky-700 dark:text-sky-400" },
} as const;

export function TeamsPanel({
  gameId,
  members,
  scoreA,
  scoreB,
}: {
  gameId: number;
  members: Member[];
  scoreA: number | null;
  scoreB: number | null;
}) {
  const [a, setA] = useState(scoreA === null ? "" : String(scoreA));
  const [b, setB] = useState(scoreB === null ? "" : String(scoreB));
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const assigned = members.filter((m) => m.team);
  const hasTeams = assigned.length === members.length && members.length > 0;
  const dirty = a !== (scoreA === null ? "" : String(scoreA)) || b !== (scoreB === null ? "" : String(scoreB));

  function submitScore(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const clear = a === "" && b === "";
      const r = await saveScore(gameId, clear ? null : Number(a), clear ? null : Number(b));
      setError(r.error);
      setSaved(!r.error);
    });
  }

  function swap(m: Member) {
    start(async () => {
      const r = await setTeam(gameId, m.id, m.team === "A" ? "B" : "A");
      setError(r.error);
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className={sectionTitle}>Teams</h2>
        <ConfirmButton
          label={hasTeams ? "Shuffle" : "Make teams"}
          confirmLabel="Re-draw teams?"
          className={btnGhost}
          onConfirm={() => shuffleTeams(gameId)}
        />
      </div>

      {!hasTeams ? (
        <p className={muted}>No teams for this game yet. Tap Make teams to split everyone into two sides.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {(["A", "B"] as const).map((t) => {
            const side = members.filter((m) => m.team === t);
            return (
              <div key={t} className={`${card} overflow-hidden p-0`}>
                <div className={`h-1.5 ${style[t].bar}`} />
                <div className="p-3">
                  <p className={`flex items-baseline justify-between font-semibold ${style[t].text}`}>
                    {style[t].name}
                    <span className="text-xs font-medium text-foreground/50">{side.length}</span>
                  </p>
                  <ul className="mt-2 flex flex-col gap-1">
                    {side.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => swap(m)}
                          disabled={pending}
                          aria-label={`Move ${m.name} to Team ${t === "A" ? "B" : "A"}`}
                          className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-sm transition hover:bg-subtle active:scale-[0.98] disabled:opacity-60"
                        >
                          <Avatar name={m.name} size="sm" />
                          <span className="min-w-0 flex-1 truncate">{m.name}</span>
                          {m.guest && <span className={pill.gray}>guest</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {hasTeams && <p className={muted}>Tap a player to switch their team.</p>}

      <form onSubmit={submitScore} className={`${card} flex flex-col gap-3`}>
        <p className={sectionTitle}>Score</p>
        <div className="flex items-center justify-center gap-3">
          <label className="flex flex-col items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            Team A
            <input
              value={a}
              onChange={(e) => { setA(e.target.value.replace(/\D/g, "").slice(0, 2)); setSaved(false); }}
              inputMode="numeric"
              placeholder="–"
              className={`${input} w-20 text-center text-2xl font-semibold`}
            />
          </label>
          <span className="pt-5 text-xl text-foreground/40">:</span>
          <label className="flex flex-col items-center gap-1 text-xs font-semibold text-sky-700 dark:text-sky-400">
            Team B
            <input
              value={b}
              onChange={(e) => { setB(e.target.value.replace(/\D/g, "").slice(0, 2)); setSaved(false); }}
              inputMode="numeric"
              placeholder="–"
              className={`${input} w-20 text-center text-2xl font-semibold`}
            />
          </label>
        </div>
        {error && <p role="alert" className="text-center text-sm text-red-600">{error}</p>}
        <button disabled={pending || !dirty} className={`${btn} self-center`}>
          {pending ? "Saving…" : saved ? "Saved" : "Save score"}
        </button>
      </form>
    </section>
  );
}
