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
