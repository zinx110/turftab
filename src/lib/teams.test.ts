import { describe, expect, it } from "vitest";
import { assignTeams, freshDraw, outcomeFor, samePartition, type Team } from "./teams";

// deterministic "random" so tests never flake
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const sizes = (m: Map<number, Team>) => {
  const v = [...m.values()];
  return [v.filter((t) => t === "A").length, v.filter((t) => t === "B").length];
};

describe("assignTeams", () => {
  it("splits fairly: sides never differ by more than one, everyone is placed once", () => {
    for (let n = 1; n <= 24; n++) {
      for (let seed = 1; seed <= 10; seed++) {
        const ids = Array.from({ length: n }, (_, i) => i + 1);
        const m = assignTeams(ids, new Map(), seeded(seed));
        expect(m.size).toBe(n);
        const [a, b] = sizes(m);
        expect(Math.abs(a - b)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("is actually random: different seeds give different teams", () => {
    const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const seen = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const m = assignTeams(ids, new Map(), seeded(seed));
      seen.add(ids.map((i) => m.get(i)).join(""));
    }
    expect(seen.size).toBeGreaterThan(5);
  });

  it("keeps existing teams when someone is added or removed", () => {
    const existing = new Map<number, Team>([[1, "A"], [2, "A"], [3, "B"], [4, "B"]]);
    const m = assignTeams([1, 2, 3, 4, 5], existing, seeded(3)); // 5 joins
    for (const [id, t] of existing) expect(m.get(id)).toBe(t);
    expect(m.size).toBe(5);

    const removed = assignTeams([1, 3, 4], existing, seeded(3)); // 2 left
    expect(removed.has(2)).toBe(false);
    expect(removed.get(1)).toBe("A");
  });

  it("sends newcomers to the smaller side", () => {
    const existing = new Map<number, Team>([[1, "A"], [2, "A"], [3, "A"]]);
    const m = assignTeams([1, 2, 3, 4, 5, 6], existing, seeded(9));
    expect([4, 5, 6].every((id) => m.get(id) === "B")).toBe(true);
  });

  it("copes with an empty list and ignores teams of people not playing", () => {
    expect(assignTeams([]).size).toBe(0);
    expect(assignTeams([1], new Map([[99, "B" as Team]])).has(99)).toBe(false);
  });
});

describe("outcomeFor", () => {
  it("works from either side", () => {
    expect(outcomeFor("A", 3, 1)).toBe("win");
    expect(outcomeFor("B", 3, 1)).toBe("loss");
    expect(outcomeFor("B", 0, 2)).toBe("win");
    expect(outcomeFor("A", 2, 2)).toBe("draw");
    expect(outcomeFor("B", 0, 0)).toBe("draw");
  });
});

describe("samePartition / freshDraw", () => {
  const ids = [1, 2, 3, 4, 5, 6];
  const t = (s: string) => new Map<number, Team>(ids.map((id, i) => [id, s[i] as Team]));

  it("treats a mirrored split as the same split", () => {
    expect(samePartition(t("AAABBB"), t("AAABBB"), ids)).toBe(true);
    expect(samePartition(t("AAABBB"), t("BBBAAA"), ids)).toBe(true);
    expect(samePartition(t("AAABBB"), t("AABABB"), ids)).toBe(false);
  });

  it("a fresh draw is never the previous split, across many seeds", () => {
    const prev = t("AAABBB");
    for (let seed = 1; seed <= 300; seed++) {
      const d = freshDraw(ids, prev, seeded(seed));
      expect(samePartition(d, prev, ids)).toBe(false);
      expect(d.size).toBe(6);
      const a = [...d.values()].filter((x) => x === "A").length;
      expect(Math.abs(a - 3)).toBeLessThanOrEqual(0); // 6 players -> 3 v 3
    }
  });

  it("copes when a different split is impossible (2 players)", () => {
    const d = freshDraw([1, 2], new Map<number, Team>([[1, "A"], [2, "B"]]), seeded(1));
    expect(d.size).toBe(2);
  });

  it("only compares the players who were in both matches", () => {
    const prev = new Map<number, Team>([[1, "A"], [2, "A"], [3, "B"], [4, "B"]]);
    const d = freshDraw([1, 2, 3, 4, 5], prev, seeded(7)); // 5 joined
    expect(samePartition(d, prev, [1, 2, 3, 4, 5])).toBe(false);
  });
});
