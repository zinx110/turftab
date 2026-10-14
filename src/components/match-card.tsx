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
import {
  addToMatch,
  deleteMatch,
  removeFromMatch,
  saveScore,
  setTeam,
  shuffleTeams,
  swapTeams,
} from "@/app/(admin)/games/actions";
import { Avatar } from "./avatar";
import { ConfirmButton } from "./confirm-button";
import { btn, btnGhost, card, input, muted } from "./ui";

type Team = "A" | "B";
type Member = { id: number; name: string; guest: boolean; team: Team };

const style = {
  A: { name: "Team A", bar: "bg-emerald-600", text: "text-emerald-700 dark:text-emerald-400", over: "ring-emerald-600/50" },
  B: { name: "Team B", bar: "bg-sky-600", text: "text-sky-700 dark:text-sky-400", over: "ring-sky-600/50" },
} as const;

function PlayerRow({
  m,
  onSwitch,
  onLeave,
  disabled,
}: {
  m: Member;
  onSwitch: () => void;
  onLeave: () => void;
  disabled: boolean;
}) {
  const [menu, setMenu] = useState(false);
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
      className={`rounded-lg transition ${drag.isDragging ? "opacity-30" : ""} ${
        drop.isOver && !drag.isDragging ? "bg-emerald-600/15 ring-2 ring-emerald-600/40" : ""
      }`}
    >
      <div className="flex items-center gap-1">
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
          onClick={() => setMenu((v) => !v)}
          aria-label={`Options for ${m.name}`}
          aria-expanded={menu}
          className="shrink-0 rounded-lg p-1.5 text-foreground/45 transition hover:bg-subtle hover:text-foreground"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
            <circle cx="5" cy="12" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="19" cy="12" r="1.8" />
          </svg>
        </button>
      </div>
      {menu && (
        <div className="mb-1 ml-9 flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => { setMenu(false); onSwitch(); }}
            className="rounded-lg border border-line px-2 py-1 text-xs font-medium hover:bg-subtle disabled:opacity-50"
          >
            Switch team
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => { setMenu(false); onLeave(); }}
            className="rounded-lg border border-red-600/30 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-600/5 disabled:opacity-50"
          >
            Left early
          </button>
        </div>
      )}
    </li>
  );
}

function TeamColumn(props: { team: Team; members: Member[]; onSwitch: (m: Member) => void; onLeave: (m: Member) => void; busy: boolean }) {
  const { team, members, onSwitch, onLeave, busy } = props;
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
            <PlayerRow key={m.id} m={m} onSwitch={() => onSwitch(m)} onLeave={() => onLeave(m)} disabled={busy} />
          ))}
        </ul>
      </div>
    </div>
  );
}

export function MatchCard({
  match,
  bench,
}: {
  match: { id: number; number: number; scoreA: number | null; scoreB: number | null; players: Member[] };
  // game-day attendees who aren't in this match (late, or left early)
  bench: { id: number; name: string }[];
}) {
  const [members, setMembers] = useState(match.players);
  const [a, setA] = useState(match.scoreA === null ? "" : String(match.scoreA));
  const [b, setB] = useState(match.scoreB === null ? "" : String(match.scoreB));
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [active, setActive] = useState<Member | null>(null);
  const [pick, setPick] = useState("");
  const [pending, start] = useTransition();

  // Show changes immediately, and re-sync whenever the server sends fresh data.
  const [seen, setSeen] = useState(match.players);
  if (seen !== match.players) {
    setSeen(match.players);
    setMembers(match.players);
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // press-and-hold on touch, so ordinary scrolling never picks someone up
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const dirty = a !== (match.scoreA === null ? "" : String(match.scoreA)) || b !== (match.scoreB === null ? "" : String(match.scoreB));
  const other = (t: Team): Team => (t === "A" ? "B" : "A");

  function run(optimistic: Member[], action: () => Promise<{ error?: string }>) {
    const previous = members;
    setMembers(optimistic);
    setError(undefined);
    start(async () => {
      const r = await action();
      if (r.error) {
        setMembers(previous); // undo the change
        setError(r.error);
      }
    });
  }

  const switchTeam = (m: Member) =>
    run(members.map((x) => (x.id === m.id ? { ...x, team: other(m.team) } : x)), () => setTeam(match.id, m.id, other(m.team)));
  const leave = (m: Member) => run(members.filter((x) => x.id !== m.id), () => removeFromMatch(match.id, m.id));

  function onDragStart(e: DragStartEvent) {
    setActive(members.find((m) => m.id === e.active.data.current?.id) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setActive(null);
    const from = members.find((m) => m.id === e.active.data.current?.id);
    const over = e.over;
    if (!from || !over) return;

    const overPlayer = members.find((m) => m.id === over.data.current?.id);
    if (overPlayer) {
      if (overPlayer.team === from.team) return; // swapping only makes sense across teams
      run(
        members.map((x) => (x.id === from.id ? { ...x, team: overPlayer.team } : x.id === overPlayer.id ? { ...x, team: from.team } : x)),
        () => swapTeams(match.id, from.id, overPlayer.id),
      );
      return;
    }
    const target = over.data.current?.team as Team | undefined;
    if (target && target !== from.team) switchTeam(from);
  }

  function submitScore(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const clear = a === "" && b === "";
      const r = await saveScore(match.id, clear ? null : Number(a), clear ? null : Number(b));
      setError(r.error);
      setSaved(!r.error);
    });
  }

  function addFromBench() {
    if (!pick) return;
    start(async () => {
      const r = await addToMatch(match.id, Number(pick));
      setError(r.error);
      if (!r.error) setPick("");
    });
  }

  const sizeA = members.filter((m) => m.team === "A").length;
  const sizeB = members.length - sizeA;

  return (
    <section className="flex flex-col gap-3" aria-label={`Match ${match.number}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">
          Match {match.number}
          {sizeA !== sizeB && members.length > 0 && (
            <span className="ml-2 text-xs font-medium text-foreground/50">
              {sizeA} v {sizeB}
            </span>
          )}
        </h3>
        <ConfirmButton label="Shuffle" confirmLabel="Re-draw teams?" className={btnGhost} onConfirm={() => shuffleTeams(match.id)} />
      </div>

      {members.length === 0 ? (
        <p className={muted}>Nobody is in this match yet. Add players from the game day below.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
          <div className="grid grid-cols-2 gap-3">
            {(["A", "B"] as const).map((t) => (
              <TeamColumn key={t} team={t} members={members.filter((m) => m.team === t)} onSwitch={switchTeam} onLeave={leave} busy={pending} />
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
      )}

      {bench.length > 0 && (
        <div className="flex gap-2">
          <select value={pick} onChange={(e) => setPick(e.target.value)} className={input} aria-label={`Add a player to match ${match.number}`}>
            <option value="">Add to this match…</option>
            {bench.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={addFromBench} disabled={pending || !pick} className={btnGhost}>
            Add
          </button>
        </div>
      )}

      <form onSubmit={submitScore} className={`${card} flex items-center justify-center gap-3`}>
        <label className="flex flex-col items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          Team A
          <input
            value={a}
            onChange={(e) => { setA(e.target.value.replace(/\D/g, "").slice(0, 2)); setSaved(false); }}
            inputMode="numeric"
            placeholder="–"
            className={`${input} w-16 text-center text-2xl font-semibold`}
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
            className={`${input} w-16 text-center text-2xl font-semibold`}
          />
        </label>
        <button disabled={pending || !dirty} className={`${btn} ml-2 mt-5`}>
          {pending ? "Saving…" : saved ? "Saved" : "Save"}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-center text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between">
        <p className={muted}>Drag to swap or move. Left early? Use ⋯.</p>
        <ConfirmButton label="Delete match" confirmLabel="Delete?" className="text-sm text-red-600 underline" onConfirm={() => deleteMatch(match.id)} />
      </div>
    </section>
  );
}
