export type Team = "A" | "B";

function shuffle<T>(items: T[], rand: () => number) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Puts everyone on a team, keeping the sides within one player of each
// other. People who already have a team keep it (so editing a game doesn't
// reshuffle), and newcomers go to the smaller side, ties broken randomly.
// With no existing teams this is a fair random split.
export function assignTeams(
  playerIds: number[],
  existing: ReadonlyMap<number, Team> = new Map(),
  rand: () => number = Math.random,
) {
  const result = new Map<number, Team>();
  const counts = { A: 0, B: 0 };
  const fresh: number[] = [];
  for (const id of playerIds) {
    const t = existing.get(id);
    if (t) {
      result.set(id, t);
      counts[t]++;
    } else {
      fresh.push(id);
    }
  }
  for (const id of shuffle(fresh, rand)) {
    const t: Team = counts.A === counts.B ? (rand() < 0.5 ? "A" : "B") : counts.A < counts.B ? "A" : "B";
    result.set(id, t);
    counts[t]++;
  }
  return result;
}

export type Outcome = "win" | "draw" | "loss";

export function outcomeFor(team: Team, scoreA: number, scoreB: number): Outcome {
  if (scoreA === scoreB) return "draw";
  return (team === "A") === scoreA > scoreB ? "win" : "loss";
}
