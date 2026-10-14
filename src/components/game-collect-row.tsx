"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { markGamePaid } from "@/app/(admin)/payments/actions";
import { formatTaka } from "@/lib/money";
import { ConfirmButton } from "./confirm-button";
import { MoveShare } from "./move-share";
import { Avatar } from "./avatar";
import { btn, btnGhost, card, input, pill } from "./ui";

type Payer = {
  id: number;
  name: string;
  total: number;
  paid: number;
  due: number;
  lines: { forId: number; forName: string; charge: number; own: boolean; paid: number; due: number; movable: boolean }[];
};

export function GameCollectRow({
  gameId,
  payer,
  players,
  guestIds,
}: {
  gameId: number;
  payer: Payer;
  players: { id: number; name: string }[];
  guestIds: number[];
}) {
  const [partial, setPartial] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const settled = payer.due === 0;
  const showLines = payer.lines.length > 1 || payer.lines.some((l) => l.movable || !l.own);
  // Anyone active except the share's owner, its current payer, and guests.
  const optionsFor = (forId: number) =>
    players.filter((p) => p.id !== forId && p.id !== payer.id && !guestIds.includes(p.id));

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
        <Link href={`/players/${payer.id}`} className="flex min-w-0 items-center gap-3">
          <Avatar name={payer.name} />
          <span className="truncate font-semibold">{payer.name}</span>
        </Link>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <p className="font-bold">{formatTaka(payer.total)}</p>
          <span className={settled ? pill.green : payer.paid > 0 ? pill.amber : pill.red}>
            {settled ? "paid" : payer.paid > 0 ? `${formatTaka(payer.due)} left` : "unpaid"}
          </span>
        </div>
      </div>

      {showLines && (
        <ul className="flex flex-col gap-1 border-t border-line pt-2 text-sm">
          {payer.lines.map((l) => (
            <li key={l.forId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span>
                {l.own ? "Own share" : `For ${l.forName}`} · {formatTaka(l.charge)}
                {l.due === 0 ? " · paid" : l.paid > 0 ? " · part paid" : ""}
              </span>
              {l.movable && (
                <MoveShare
                  gameId={gameId}
                  forId={l.forId}
                  forName={l.forName}
                  options={optionsFor(l.forId)}
                  canReset={!l.own}
                />
              )}
            </li>
          ))}
        </ul>
      )}

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
