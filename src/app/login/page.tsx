import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await isAdmin()) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="inline-flex size-16 items-center justify-center rounded-2xl bg-emerald-600 text-3xl font-bold text-white shadow-md">T</span>
        <h1 className="text-2xl font-bold">TurfTab</h1>
        <p className="text-sm text-foreground/60">Sign in to manage games and payments</p>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <LoginForm />
      </div>
    </main>
  );
}
