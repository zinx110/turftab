"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/games", label: "Games" },
  { href: "/players", label: "Players" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-black/10 bg-background pb-[env(safe-area-inset-bottom)] dark:border-white/15">
      <ul className="mx-auto flex max-w-2xl">
        {links.map(({ href, label }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`block py-3 text-center text-sm ${
                  active ? "font-semibold text-emerald-600" : "opacity-70"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
