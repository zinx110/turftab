"use client";

import { markPaid } from "@/app/(admin)/payments/actions";
import { btn } from "./ui";
import { ConfirmButton } from "./confirm-button";

export function MarkPaidButton({ playerId }: { playerId: number }) {
  return (
    <ConfirmButton
      label="Mark paid"
      confirmLabel="Confirm paid"
      className={btn}
      onConfirm={() => markPaid(playerId)}
    />
  );
}
