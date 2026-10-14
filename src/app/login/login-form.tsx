"use client";

import { useActionState } from "react";
import { input, btn } from "@/components/ui";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="flex flex-col gap-3">
      <input
        type="password"
        name="password"
        autoComplete="current-password"
        placeholder="Password"
        required
        autoFocus
        className={input}
      />
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className={`${btn} w-full py-3`}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
