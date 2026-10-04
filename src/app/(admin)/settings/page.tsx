import { BkashForm, RegenerateLinkButton } from "@/components/player-controls";
import { CopyButton } from "@/components/copy-button";
import { btnGhost, muted } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getGroupToken, readSetting } from "@/lib/data";
import { EXPORTS } from "@/lib/export";
import { logout } from "../../login/actions";

export default async function SettingsPage() {
  await requireAdmin();
  const [bkash, groupToken] = await Promise.all([readSetting("bkash_number"), getGroupToken()]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">bKash number</h2>
        <p className={muted}>Shown on the group and personal pages.</p>
        <BkashForm initial={bkash ?? ""} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Group link</h2>
        <p className={muted}>Lists games, costs and who played. Never shows who owes or has paid.</p>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={`{origin}/s/${groupToken}`} label="Copy link" />
          <RegenerateLinkButton />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Export data</h2>
        <p className={muted}>
          Download a copy as CSV, so your records don&apos;t depend on the database alone.
        </p>
        <ul className="flex flex-wrap gap-2">
          {EXPORTS.map((name) => (
            <li key={name}>
              <a href={`/export/${name}`} download className={btnGhost}>
                {name}.csv
              </a>
            </li>
          ))}
        </ul>
      </section>

      <form action={logout}>
        <button className="text-sm underline">Log out</button>
      </form>
    </div>
  );
}
