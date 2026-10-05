"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { markGamePaid } from "@/app/(admin)/payments/actions";
import { formatTaka } from "@/lib/money";
import { ConfirmButton } from "./confirm-button";
import { btn, btnGhost, card, input, muted } from "./ui";

type Payer = {
  id: number;
  name: string;
  total: number;
  paid: number;
  due: number;
  lines: { forName: string; charge: number; own: boolean }[];
};

export function GameCollectRow({ gameId, payer }: { gameId: number; payer: Payer }) {
  const [partial, setPartial] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const settled = payer.due === 0;
  const breakdown =
    payer.lines.length > 1 || payer.lines.some((l) => !l.own)
      ? payer.lines.map((l) => (l.own ? `own ${formatTaka(l.charge)}` : `for ${l.forName} ${formatTaka(l.charge)}`)).join(" · ")
      : null;

  function savePartial(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await markGamePaid(gameId, payer.id, Number(amount));
      setError(r.error);
      if (!r.error) {
        setPartial(false);
        setAmount("");
      }
    });
  }

  return (
    <li className={`${card} flex flex-col gap-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/players/${payer.id}`} className="block truncate font-medium">
            {payer.name}
          </Link>
          {breakdown && <p className={muted}>{breakdown}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-semibold">{formatTaka(payer.total)}</p>
          <p className={`text-sm ${settled ? "text-emerald-600" : "text-red-600"}`}>
            {settled ? "paid" : payer.paid > 0 ? `${formatTaka(payer.due)} left` : "unpaid"}
          </p>
        </div>
      </div>

      {!settled && (
        <div className="flex flex-wrap items-start justify-end gap-2">
          <button type="button" onClick={() => setPartial((v) => !v)} className={btnGhost}>
            {partial ? "Cancel" : "Partial"}
          </button>
          <ConfirmButton
            label={`Mark paid ${formatTaka(payer.due)}`}
            confirmLabel="Confirm paid"
            className={btn}
            onConfirm={() => markGamePaid(gameId, payer.id)}
          />
        </div>
      )}

      {partial && !settled && (
        <form onSubmit={savePartial} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder={`৳ amount (up to ${payer.due})`}
              className={input}
              aria-label={`Amount ${payer.name} paid`}
              autoFocus
            />
            <button disabled={pending || !amount} className={btn}>
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </form>
      )}
    </li>
  );
}
