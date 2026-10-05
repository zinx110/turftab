// Which games has a player paid for? Payments are applied like this:
//  1. A payment tied to a game ("Mark paid" on that game) goes to that game
//     first. Anything beyond what's due there spills into the general pool.
//  2. Untied payments, and spill-over, fill the oldest unpaid game first.
// The total owed is always charges - payments; this only decides how the
// per-game status is displayed.

export type ChargeRow = { gameId: number; playedOn: string; charge: number };
export type PaymentRow = { amount: number; gameId: number | null };
export type AllocatedCharge = ChargeRow & { paid: number; due: number };

export function allocatePayments(charges: ChargeRow[], payments: PaymentRow[] | number) {
  // A game can have several charge lines for one payer (their own share plus
  // someone they cover), so sum them per game.
  const byGame = new Map<number, AllocatedCharge>();
  for (const c of charges) {
    const g = byGame.get(c.gameId);
    if (g) {
      g.charge += c.charge;
      g.due += c.charge;
    } else {
      byGame.set(c.gameId, { ...c, paid: 0, due: c.charge });
    }
  }

  const rows: PaymentRow[] =
    typeof payments === "number" ? [{ amount: payments, gameId: null }] : payments;

  let pool = 0;
  for (const p of rows) {
    const amount = Math.max(p.amount, 0);
    const game = p.gameId === null ? undefined : byGame.get(p.gameId);
    if (!game) {
      pool += amount;
      continue;
    }
    const applied = Math.min(amount, game.due);
    game.paid += applied;
    game.due -= applied;
    pool += amount - applied;
  }

  const games = [...byGame.values()].sort(
    (a, b) => a.playedOn.localeCompare(b.playedOn) || a.gameId - b.gameId,
  );
  for (const g of games) {
    const take = Math.min(g.due, pool);
    g.paid += take;
    g.due -= take;
    pool -= take;
  }
  // anything left over is an advance / overpayment
  return { games, credit: pool };
}
