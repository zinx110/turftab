"use client";

import { useState, useTransition } from "react";
import { addMatch } from "@/app/(admin)/games/actions";
import { btn } from "./ui";

export function AddMatchButton({ gameId, next }: { gameId: number; next: number }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await addMatch(gameId);
            setError(r.error);
          })
        }
        className={`${btn} w-full py-3`}
      >
        {pending ? "Drawing teams…" : `+ Add match ${next}`}
      </button>
      {error && (
        <p role="alert" className="text-center text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
