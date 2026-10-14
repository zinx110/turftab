"use client";

import { useSyncExternalStore } from "react";
import { CopyButton } from "./copy-button";
import { card, input, muted } from "./ui";

const subscribe = () => () => {};

// Shows the full public link for this game (selectable, with a Copy button).
// The origin comes from the browser, so it's right in dev and on the live site.
export function ShareLink({ path }: { path: string }) {
  const origin = useSyncExternalStore(subscribe, () => window.location.origin, () => "");
  return (
    <section className={`${card} flex flex-col gap-2`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">Public link</p>
        <p className={muted}>read-only · no login</p>
      </div>
      <div className="flex gap-2">
        <input
          readOnly
          value={`${origin}${path}`}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Public link for this game"
          className={`${input} min-w-0 text-sm`}
        />
        <CopyButton text={`{origin}${path}`} label="Copy" />
      </div>
    </section>
  );
}
