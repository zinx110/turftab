import { card, pill } from "./ui";

type Person = { name: string; guest: boolean };
export type MatchViewData = {
  number: number;
  scoreA: number | null;
  scoreB: number | null;
  teams: { A: Person[]; B: Person[] };
};

function Roster({ people, align }: { people: Person[]; align: "left" | "right" }) {
  return (
    <ul className={`flex flex-col gap-1.5 ${align === "right" ? "items-end text-right" : "items-start"}`}>
      {people.map((p, i) => (
        <li key={i} className="flex flex-wrap items-center gap-1.5 text-sm leading-tight">
          <span className="break-words">{p.name}</span>
          {p.guest && <span className={pill.amber}>guest</span>}
        </li>
      ))}
      {people.length === 0 && <li className="text-sm text-foreground/40">–</li>}
    </ul>
  );
}

// Read-only match: a scoreboard header (or "vs" when not scored yet) and the
// two rosters side by side, in one card.
export function MatchView({ match }: { match: MatchViewData }) {
  const { A, B } = match.teams;
  const scored = match.scoreA !== null && match.scoreB !== null;
  return (
    <section className={`${card} overflow-hidden p-0!`} aria-label={`Match ${match.number}`}>
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h3 className="font-bold">Match {match.number}</h3>
        {A.length !== B.length && (
          <span className={pill.gray}>
            {A.length} v {B.length}
          </span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 bg-subtle px-4 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Team A</p>
        </div>
        <p className="text-4xl font-extrabold tabular-nums tracking-tight">
          {scored ? (
            <>
              <span className="text-emerald-700 dark:text-emerald-400">{match.scoreA}</span>
              <span className="px-2 text-foreground/30">:</span>
              <span className="text-sky-700 dark:text-sky-400">{match.scoreB}</span>
            </>
          ) : (
            <span className="text-lg font-semibold text-foreground/40">vs</span>
          )}
        </p>
        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">Team B</p>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-line">
        <div className="border-t-4 border-emerald-600 p-4">
          <Roster people={A} align="left" />
        </div>
        <div className="border-t-4 border-sky-600 p-4">
          <Roster people={B} align="right" />
        </div>
      </div>
    </section>
  );
}
