// Payments aren't tied to a game. To show which games a player still owes
// for, payments are applied to the oldest game first.

export type ChargeRow = { gameId: number; playedOn: string; charge: number };
export type AllocatedCharge = ChargeRow & { paid: number; due: number };

export function allocatePayments(charges: ChargeRow[], totalPaid: number) {
  const ordered = [...charges].sort(
    (a, b) => a.playedOn.localeCompare(b.playedOn) || a.gameId - b.gameId,
  );
  let remaining = Math.max(totalPaid, 0);
  const games: AllocatedCharge[] = ordered.map((c) => {
    const paid = Math.min(c.charge, remaining);
    remaining -= paid;
    return { ...c, paid, due: c.charge - paid };
  });
  // anything left over is an advance / overpayment
  return { games, credit: remaining };
}
