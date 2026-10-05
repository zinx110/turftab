// Money is whole taka. Charge per head is rounded UP so the organiser never
// covers a shortfall; the leftover is the game's surplus.

export function perHeadCharge(total: number, headcount: number) {
  if (!Number.isInteger(total) || total < 0) {
    throw new RangeError("total must be a non-negative integer");
  }
  if (!Number.isInteger(headcount) || headcount < 1) {
    throw new RangeError("headcount must be a positive integer");
  }
  const q = Math.floor(total / headcount);
  return q * headcount === total ? q : q + 1;
}

export function surplus(total: number, headcount: number) {
  return perHeadCharge(total, headcount) * headcount - total;
}

export function formatTaka(n: number) {
  return `${n < 0 ? "-" : ""}৳${Math.abs(n).toLocaleString("en-US")}`;
}

// ---- who is billed for a game ----------------------------------------------

export type Attendee = {
  playerId: number;
  guest?: boolean; // plays free: excluded from the headcount, charged nothing
  billedToId?: number | null; // transfer: their share is billed to this player
};

export type ChargeLine = {
  playerId: number;
  guest: boolean;
  charge: number; // this attendee's share (0 for guests)
  billedToId: number | null; // who owes it; null = the attendee themselves
};

// Guests are excluded from the headcount, so the others split the whole
// cost. A transferred share still counts in the headcount (the attendee
// still "played"); only who owes it changes.
export function computeCharges(total: number, attendees: Attendee[]) {
  const guestIds = new Set(attendees.filter((a) => a.guest).map((a) => a.playerId));
  if (new Set(attendees.map((a) => a.playerId)).size !== attendees.length) {
    throw new RangeError("Someone is listed twice.");
  }
  for (const a of attendees) {
    if (a.guest && a.billedToId != null) throw new RangeError("A guest can't be covered by someone.");
    if (a.billedToId != null && a.billedToId === a.playerId) {
      throw new RangeError("A player can't cover themselves.");
    }
    if (a.billedToId != null && guestIds.has(a.billedToId)) {
      throw new RangeError("Can't bill a share to someone who is a guest in this game.");
    }
  }

  const headcount = attendees.filter((a) => !a.guest).length;
  if (headcount === 0) throw new RangeError("At least one player must pay.");

  const perHead = perHeadCharge(total, headcount);
  const lines: ChargeLine[] = attendees.map((a) => ({
    playerId: a.playerId,
    guest: !!a.guest,
    charge: a.guest ? 0 : perHead,
    billedToId: a.guest ? null : (a.billedToId ?? null),
  }));
  return { perHead, headcount, surplus: perHead * headcount - total, lines };
}
