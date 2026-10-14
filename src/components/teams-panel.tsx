"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState, useTransition } from "react";
import { saveScore, setTeam, shuffleTeams, swapTeams } from "@/app/(admin)/games/actions";
import { Avatar } from "./avatar";
import { ConfirmButton } from "./confirm-button";
import { btn, btnGhost, card, input, muted, sectionTitle } from "./ui";

type Team = "A" | "B";
type Member = { id: number; name: string; guest: boolean; team: Team | null };

const style = {
  A: { name: "Team A", bar: "bg-emerald-600", text: "text-emerald-700 dark:text-emerald-400", over: "ring-emerald-600/50" },
  B: { name: "Team B", bar: "bg-sky-600", text: "text-sky-700 dark:text-sky-400", over: "ring-sky-600/50" },
} as const;

function PlayerRow({ m, onSwitch, disabled }: { m: Member; onSwitch: () => void; disabled: boolean }) {
  // Each player is both something you can pick up and a place to drop onto
  // (dropping on a player swaps the two).
  const drag = useDraggable({ id: `p${m.id}`, data: { id: m.id } });
  const drop = useDroppable({ id: `d${m.id}`, data: { id: m.id } });
  return (
    <li
      ref={(el) => {
        drag.setNodeRef(el);
        drop.setNodeRef(el);
      }}
      className={`flex items-center gap-1 rounded-lg transition ${drag.isDragging ? "opacity-30" : ""} ${
        drop.isOver && !drag.isDragging ? "bg-emerald-600/15 ring-2 ring-emerald-600/40" : ""
      }`}
    >
      <div
        {...drag.listeners}
        {...drag.attributes}
        aria-label={`${m.name}. Drag to swap or move.`}
        className="flex min-w-0 flex-1 cursor-grab touch-manipulation select-none items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-sm active:cursor-grabbing"
      >
        <Avatar name={m.name} size="sm" />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate">{m.name}</span>
          {m.guest && <span className="block text-[11px] font-medium text-amber-700 dark:text-amber-400">guest</span>}
        </span>
      </div>
      <button
        type="button"
        onClick={onSwitch}
        disabled={disabled}
        aria-label={`Move ${m.name} to the other team`}
        className="shrink-0 rounded-lg p-1.5 text-foreground/45 transition hover:bg-subtle hover:text-foreground disabled:opacity-40"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
        </svg>
      </button>
    </li>
  );
}

function TeamColumn({ team, members, onSwitch, busy }: { team: Team; members: Member[]; onSwitch: (m: Member) => void; busy: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `team${team}`, data: { team } });
  const s = style[team];
  return (
    <div ref={setNodeRef} className={`${card} overflow-hidden p-0 transition ${isOver ? `ring-2 ${s.over}` : ""}`}>
      <div className={`h-1.5 ${s.bar}`} />
      <div className="min-h-24 p-2.5">
        <p className={`flex items-baseline justify-between px-1.5 font-semibold ${s.text}`}>
          {s.name}
          <span className="text-xs font-medium text-foreground/50">{members.length}</span>
        </p>
        <ul className="mt-1.5 flex flex-col">
          {members.map((m) => (
            <PlayerRow key={m.id} m={m} onSwitch={() => onSwitch(m)} disabled={busy} />
          ))}
        </ul>
      </div>
    </div>
  );
}

export function TeamsPanel({
  gameId,
  members: serverMembers,
  scoreA,
  scoreB,
}: {
  gameId: number;
  members: Member[];
  scoreA: number | null;
  scoreB: number | null;
}) {
  const [members, setMembers] = useState(serverMembers);
  const [a, setA] = useState(scoreA === null ? "" : String(scoreA));
  const [b, setB] = useState(scoreB === null ? "" : String(scoreB));
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [active, setActive] = useState<Member | null>(null);
  const [pending, start] = useTransition();

  // Show drags immediately, and re-sync whenever the server sends fresh data.
  const [seen, setSeen] = useState(serverMembers);
  if (seen !== serverMembers) {
    setSeen(serverMembers);
    setMembers(serverMembers);
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // press-and-hold on touch, so ordinary scrolling never picks someone up
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const hasTeams = members.length > 0 && members.every((m) => m.team);
  const dirty = a !== (scoreA === null ? "" : String(scoreA)) || b !== (scoreB === null ? "" : String(scoreB));

  function run(optimistic: Member[], action: () => Promise<{ error?: string }>) {
    const previous = members;
    setMembers(optimistic);
    setError(undefined);
    start(async () => {
      const r = await action();
      if (r.error) {
        setMembers(previous); // undo the move
        setError(r.error);
      }
    });
  }

  const other = (t: Team): Team => (t === "A" ? "B" : "A");

  function switchTeam(m: Member) {
    if (!m.team) return;
    run(members.map((x) => (x.id === m.id ? { ...x, team: other(m.team!) } : x)), () => setTeam(gameId, m.id, other(m.team!)));
  }

  function onDragStart(e: DragStartEvent) {
    setActive(members.find((m) => m.id === e.active.data.current?.id) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setActive(null);
    const from = members.find((m) => m.id === e.active.data.current?.id);
    const over = e.over;
    if (!from?.team || !over) return;

    const overPlayer = members.find((m) => m.id === over.data.current?.id);
    if (overPlayer) {
      // dropped on a player: swap, but only across teams
      if (!overPlayer.team || overPlayer.team === from.team) return;
      run(
        members.map((x) => (x.id === from.id ? { ...x, team: overPlayer.team } : x.id === overPlayer.id ? { ...x, team: from.team } : x)),
        () => swapTeams(gameId, from.id, overPlayer.id),
      );
      return;
    }
    // dropped on a team's area: move there
    const target = over.data.current?.team as Team | undefined;
    if (target && target !== from.team) switchTeam(from);
  }

  function submitScore(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const clear = a === "" && b === "";
      const r = await saveScore(gameId, clear ? null : Number(a), clear ? null : Number(b));
      setError(r.error);
      setSaved(!r.error);
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
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActive(null)}
          >
            <div className="grid grid-cols-2 gap-3">
              {(["A", "B"] as const).map((t) => (
                <TeamColumn key={t} team={t} members={members.filter((m) => m.team === t)} onSwitch={switchTeam} busy={pending} />
              ))}
            </div>
            <DragOverlay dropAnimation={null}>
              {active && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-600/40 bg-surface px-2.5 py-2 text-sm shadow-xl">
                  <Avatar name={active.name} size="sm" />
                  <span className="font-medium">{active.name}</span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
          <p className={muted}>
            Drag a player onto someone on the other team to swap, or onto the other team to move them. On a phone, press and hold first. The ⇄ button also moves a player.
          </p>
        </>
      )}

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
