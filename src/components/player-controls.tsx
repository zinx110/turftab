"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deletePayment, markPaid } from "@/app/(admin)/payments/actions";
import {
  createPlayer,
  regeneratePlayerToken,
  setPlayerActive,
  updatePlayer,
} from "@/app/(admin)/players/actions";
import { regenerateGroupToken, saveBkash } from "@/app/(admin)/settings/actions";
import { ConfirmButton } from "./confirm-button";
import { btn, btnDanger, btnGhost, input } from "./ui";

function useSubmit() {
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      const r = await fn();
      setError(r.error);
      setSaved(!r.error);
    });
  return { error, saved, pending, run };
}

const Status = ({ error, saved }: { error?: string; saved: boolean }) =>
  error ? <p role="alert" className="text-sm text-red-600">{error}</p> : saved ? <p className="text-sm text-emerald-600">Saved</p> : null;

export function AddPlayerForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const { error, pending, run } = useSubmit();
  const router = useRouter();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          const r = await createPlayer({ name, phone });
          if (!r.error) {
            setName("");
            setPhone("");
            router.refresh();
          }
          return r;
        });
      }}
    >
      <div className="flex gap-2">
        <input placeholder="Player name" value={name} onChange={(e) => setName(e.target.value)} className={input} required maxLength={60} />
        <input placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} className={`${input} max-w-44`} maxLength={30} inputMode="tel" />
      </div>
      <Status error={error} saved={false} />
      <button disabled={pending || !name.trim()} className={`${btn} self-start`}>
        {pending ? "Adding…" : "Add player"}
      </button>
    </form>
  );
}

export function PlayerProfileForm({ id, name: n, phone: p }: { id: number; name: string; phone: string }) {
  const [name, setName] = useState(n);
  const [phone, setPhone] = useState(p);
  const { error, saved, pending, run } = useSubmit();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updatePlayer(id, { name, phone }));
      }}
    >
      <input value={name} onChange={(e) => setName(e.target.value)} className={input} required maxLength={60} aria-label="Name" />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" className={input} maxLength={30} inputMode="tel" aria-label="Phone" />
      <Status error={error} saved={saved} />
      <button disabled={pending} className={`${btnGhost} self-start`}>
        Save
      </button>
    </form>
  );
}

// Partial / advance payment. The one-tap full "Mark paid" lives on the dashboard.
export function PayForm({ playerId, balance }: { playerId: number; balance: number }) {
  const [amount, setAmount] = useState(balance > 0 ? String(balance) : "");
  const { error, pending, run } = useSubmit();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => markPaid(playerId, Number(amount)));
      }}
    >
      <div className="flex gap-2">
        <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="৳ amount" className={input} aria-label="Amount paid" />
        <button disabled={pending || !amount} className={btn}>
          {pending ? "Saving…" : "Mark paid"}
        </button>
      </div>
      <Status error={error} saved={false} />
    </form>
  );
}

export function DeletePaymentButton({ id }: { id: number }) {
  return <ConfirmButton label="Undo" confirmLabel="Confirm undo" className="text-sm underline" onConfirm={() => deletePayment(id)} />;
}

export function ArchiveButton({ id, active }: { id: number; active: boolean }) {
  return (
    <ConfirmButton
      label={active ? "Archive player" : "Restore player"}
      confirmLabel="Tap again to confirm"
      className={btnGhost}
      onConfirm={() => setPlayerActive(id, !active)}
    />
  );
}

export function RegenerateLinkButton({ playerId }: { playerId?: number }) {
  return (
    <ConfirmButton
      label="Regenerate link"
      confirmLabel="Old link will stop working"
      className={btnDanger}
      onConfirm={() => (playerId ? regeneratePlayerToken(playerId) : regenerateGroupToken())}
    />
  );
}

export function BkashForm({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const { error, saved, pending, run } = useSubmit();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveBkash(value));
      }}
    >
      <div className="flex gap-2">
        <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="tel" placeholder="01XXXXXXXXX" className={input} maxLength={30} aria-label="bKash number" />
        <button disabled={pending} className={btn}>
          Save
        </button>
      </div>
      <Status error={error} saved={saved} />
    </form>
  );
}
