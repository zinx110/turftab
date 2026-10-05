import { describe, expect, it } from "vitest";
import { allocatePayments } from "./ledger";

const g = (gameId: number, playedOn: string, charge = 430) => ({ gameId, playedOn, charge });

describe("allocatePayments", () => {
  const three = [g(1, "2026-09-06"), g(2, "2026-09-13"), g(3, "2026-09-20")];

  it("applies a partial payment to the oldest game first", () => {
    const { games, credit } = allocatePayments(three, 500);
    expect(games.map((x) => [x.paid, x.due])).toEqual([
      [430, 0],
      [70, 360],
      [0, 430],
    ]);
    expect(credit).toBe(0);
  });

  it("settles everything when paid in full", () => {
    const { games, credit } = allocatePayments(three, 1290);
    expect(games.every((x) => x.due === 0)).toBe(true);
    expect(credit).toBe(0);
  });

  it("reports an overpayment as credit", () => {
    const { games, credit } = allocatePayments(three, 1500);
    expect(games.every((x) => x.due === 0)).toBe(true);
    expect(credit).toBe(210);
  });

  it("leaves everything due with no payments", () => {
    const { games } = allocatePayments(three, 0);
    expect(games.map((x) => x.due)).toEqual([430, 430, 430]);
  });

  it("orders by date regardless of input order", () => {
    const { games } = allocatePayments([three[2], three[0], three[1]], 430);
    expect(games.map((x) => x.gameId)).toEqual([1, 2, 3]);
    expect(games[0].due).toBe(0);
    expect(games[1].due).toBe(430);
  });

  it("handles a player with no games", () => {
    expect(allocatePayments([], 100)).toEqual({ games: [], credit: 100 });
  });

  it("per-game dues always add up to charges minus payments", () => {
    for (const paid of [0, 1, 429, 430, 431, 860, 1289, 1290, 5000]) {
      const { games, credit } = allocatePayments(three, paid);
      const due = games.reduce((s, x) => s + x.due, 0);
      expect(due - credit).toBe(1290 - paid);
    }
  });
});

describe("allocatePayments with game-tied payments", () => {
  const three = [g(1, "2026-09-06"), g(2, "2026-09-13"), g(3, "2026-09-20")];
  const dues = (r: ReturnType<typeof allocatePayments>) => r.games.map((x) => x.due);

  it("a payment tied to a newer game pays that game, not the oldest", () => {
    const r = allocatePayments(three, [{ amount: 430, gameId: 3 }]);
    expect(dues(r)).toEqual([430, 430, 0]);
  });

  it("a partial tied payment leaves the rest of that game due", () => {
    const r = allocatePayments(three, [{ amount: 100, gameId: 2 }]);
    expect(dues(r)).toEqual([430, 330, 430]);
  });

  it("tied overpayment spills into the oldest unpaid game", () => {
    const r = allocatePayments(three, [{ amount: 500, gameId: 3 }]);
    expect(dues(r)).toEqual([360, 430, 0]); // 430 clears game 3, 70 spills to game 1
    expect(r.credit).toBe(0);
  });

  it("tied payments are applied before untied ones regardless of order", () => {
    const r = allocatePayments(three, [
      { amount: 430, gameId: null },
      { amount: 430, gameId: 3 },
    ]);
    expect(dues(r)).toEqual([0, 430, 0]);
  });

  it("a tied payment for an unknown game just joins the pool", () => {
    const r = allocatePayments(three, [{ amount: 430, gameId: 99 }]);
    expect(dues(r)).toEqual([0, 430, 430]);
  });

  it("sums several charge lines in the same game (own share + someone covered)", () => {
    const lines = [g(1, "2026-09-06", 430), g(1, "2026-09-06", 430), g(2, "2026-09-13", 430)];
    const r = allocatePayments(lines, [{ amount: 860, gameId: 1 }]);
    expect(r.games.map((x) => [x.gameId, x.charge, x.due])).toEqual([
      [1, 860, 0],
      [2, 430, 430],
    ]);
  });

  it("always: total due minus credit equals charges minus payments", () => {
    const pays = [
      { amount: 100, gameId: 2 },
      { amount: 700, gameId: 3 },
      { amount: 50, gameId: null },
    ];
    const r = allocatePayments(three, pays);
    const due = r.games.reduce((s, x) => s + x.due, 0);
    expect(due - r.credit).toBe(1290 - 850);
  });
});
