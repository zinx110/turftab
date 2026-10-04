import { Nav } from "@/components/nav";

// Layout is chrome only. Auth is enforced in each page and action, because
// layouts don't re-run on client-side navigation.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-6">{children}</main>
      <Nav />
    </>
  );
}
