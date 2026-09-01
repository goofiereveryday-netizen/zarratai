"use client";

import { useState } from "react";
import Link from "next/link";
import { logout } from "@/app/actions/auth";

type NavItem = {
  label: string;
  href: string;
  primary?: boolean;
};

const navItems: NavItem[] = [
  { label: "Assistant", href: "#assistant", primary: true },
  { label: "My Farms", href: "#my-farms" },
  { label: "Farm History", href: "#farm-history" },
  { label: "Farm Weather", href: "#farm-weather" },
  { label: "Settings", href: "#settings" },
];

function MenuIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="6" y1="18" x2="18" y2="6" />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 2 8 0 5.5-4.8 10-10 10Z" />
      <path d="M2 21c0-3 1.9-5.5 4.5-6.5" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function FarmIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 21h18" />
      <path d="M9 8h6" />
      <path d="M12 8v13" />
      <path d="M5 21V10l7-5 7 5v11" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function WeatherIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

const navIcons: Record<string, () => React.JSX.Element> = {
  Assistant: ChatIcon,
  "My Farms": FarmIcon,
  "Farm History": HistoryIcon,
  "Farm Weather": WeatherIcon,
  Settings: SettingsIcon,
};

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-deep-moss text-wheat-cream">
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight focus-visible:outline-citron-beam"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-olive-branch">
              <LeafIcon />
            </span>
            ZarratAI
          </Link>

          {/* Desktop nav */}
          <nav
            className="hidden md:flex items-center gap-1"
            aria-label="Primary navigation"
          >
            {navItems.map((item) => {
              const Icon = navIcons[item.label];
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-forest-floor focus-visible:outline-citron-beam ${
                    item.primary
                      ? "bg-harvest-copper text-wheat-cream hover:bg-harvest-copper/90"
                      : "text-wheat-cream/80 hover:text-wheat-cream"
                  }`}
                >
                  {Icon && <Icon />}
                  {item.label}
                </Link>
              );
            })}
            <form action={logout}>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-wheat-cream/60 transition-colors hover:bg-forest-floor hover:text-wheat-cream focus-visible:outline-citron-beam"
              >
                Sign out
              </button>
            </form>
          </nav>

          {/* Mobile menu toggle */}
          <button
            type="button"
            className="md:hidden flex h-10 w-10 items-center justify-center rounded-md hover:bg-forest-floor transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>

        {/* Mobile dropdown nav */}
        {menuOpen && (
          <nav
            className="md:hidden border-t border-forest-floor px-4 pb-4 pt-2"
            aria-label="Primary navigation"
          >
            {navItems.map((item) => {
              const Icon = navIcons[item.label];
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-md px-3 py-3 text-base font-medium transition-colors hover:bg-forest-floor ${
                    item.primary
                      ? "bg-harvest-copper text-wheat-cream mt-1 mb-2"
                      : "text-wheat-cream/80 hover:text-wheat-cream"
                  }`}
                >
                  {Icon && <Icon />}
                  {item.label}
                </Link>
              );
            })}
            <form action={logout}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-base font-medium text-wheat-cream/60 transition-colors hover:bg-forest-floor hover:text-wheat-cream"
              >
                Sign out
              </button>
            </form>
          </nav>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 px-4 py-6 md:px-6 md:py-8">
        <div className="mx-auto w-full max-w-3xl">
          {/* Selected farm placeholder */}
          <section
            className="mb-6 rounded-lg border border-forest-floor/20 bg-wheat-cream-light px-4 py-3"
            aria-label="Selected farm"
          >
            <div className="flex items-center gap-2 text-sm text-forest-floor">
              <FarmIcon />
              <span className="font-medium">Farm:</span>
              <span className="text-deep-moss/60">No farm selected</span>
              <Link
                href="#my-farms"
                className="ml-auto text-sm font-medium text-olive-branch underline-offset-2 hover:underline focus-visible:outline-olive-branch"
              >
                Select farm
              </Link>
            </div>
          </section>

          {/* Primary action: Ask ZarratAI */}
          <section className="mb-8 text-center md:text-left">
            <h1 className="text-2xl font-bold tracking-tight text-deep-moss md:text-3xl">
              Ask ZarratAI
            </h1>
            <p className="mt-2 text-base text-forest-floor/80 leading-relaxed max-w-lg">
              Describe the problem. Know what to do next.
            </p>
          </section>

          {/* Assistant CTA */}
          <section className="mb-10">
            <Link
              href="#assistant"
              className="group flex w-full items-center justify-center gap-3 rounded-xl bg-harvest-copper px-6 py-5 text-lg font-semibold text-wheat-cream shadow-sm transition-colors hover:bg-harvest-copper/90 focus-visible:outline-citron-beam md:max-w-md"
            >
              <ChatIcon />
              Start a conversation
            </Link>
          </section>

          {/* Quick info */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-forest-floor/60">
              What you can ask about
            </h2>
            <ul className="space-y-2 text-base text-forest-floor">
              <li className="flex items-start gap-3 rounded-lg border border-forest-floor/10 bg-wheat-cream-light px-4 py-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-olive-branch text-wheat-cream text-xs font-bold">
                  1
                </span>
                <span>Crop diseases and pest problems</span>
              </li>
              <li className="flex items-start gap-3 rounded-lg border border-forest-floor/10 bg-wheat-cream-light px-4 py-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-olive-branch text-wheat-cream text-xs font-bold">
                  2
                </span>
                <span>Pesticide and treatment guidance</span>
              </li>
              <li className="flex items-start gap-3 rounded-lg border border-forest-floor/10 bg-wheat-cream-light px-4 py-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-olive-branch text-wheat-cream text-xs font-bold">
                  3
                </span>
                <span>Farm management advice</span>
              </li>
            </ul>
          </section>
        </div>
      </main>

      {/* Mobile bottom nav bar */}
      <nav
        className="md:hidden sticky bottom-0 z-20 border-t border-forest-floor/15 bg-wheat-cream-light"
        aria-label="Mobile navigation"
      >
        <div className="flex items-stretch justify-around">
          {navItems.map((item) => {
            const Icon = navIcons[item.label];
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                  item.primary
                    ? "text-harvest-copper"
                    : "text-forest-floor/60 hover:text-forest-floor"
                }`}
              >
                {Icon && <Icon />}
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
