"use client";

import { useEffect, useState, useTransition } from "react";

// Two-tap button: the first tap arms it, the second runs the action.
// Guards one-tap money actions against accidental taps on a phone.
export function ConfirmButton({
  label,
  confirmLabel = "Tap again to confirm",
  className,
  onConfirm,
}: {
  label: string;
  confirmLabel?: string;
  className: string;
  onConfirm: () => Promise<{ error?: string } | void>;
}) {
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  function click() {
    if (!armed) return setArmed(true);
    setArmed(false);
    start(async () => {
      const result = await onConfirm();
      setError(result?.error);
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" onClick={click} disabled={pending} className={className}>
        {pending ? "Saving…" : armed ? confirmLabel : label}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
