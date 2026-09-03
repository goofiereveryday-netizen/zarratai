"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import {
  MenuIcon,
  CloseIcon,
  LeafIcon,
  ChatIcon,
  FarmIcon,
  HistoryIcon,
  WeatherIcon,
  HomeIcon,
  UserIcon,
  SettingsIcon,
} from "@/components/icons";

type NavItem = {
  label: string;
  href: string;
  primary?: boolean;
};

const navItems: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Assistant", href: "/assistant", primary: true },
  { label: "My Crops", href: "/farms" },
  { label: "History", href: "/history" },
  { label: "Weather", href: "/weather" },
];

const navIcons: Record<string, () => React.JSX.Element> = {
  Home: HomeIcon,
  Assistant: ChatIcon,
  "My Crops": FarmIcon,
  History: HistoryIcon,
  Weather: WeatherIcon,
};

export function AppShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName?: string | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const displayName = userName?.trim() || "Farmer";
  const initial = displayName.charAt(0).toUpperCase();

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

            {/* Profile dropdown */}
            <div className="relative ml-2" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-wheat-cream/80 transition-colors hover:bg-forest-floor hover:text-wheat-cream focus-visible:outline-citron-beam"
                aria-expanded={profileOpen}
                aria-label="Profile menu"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-olive-branch text-xs font-bold text-wheat-cream">
                  {initial}
                </span>
              </button>

              {profileOpen && (
                <>
                  {/* Backdrop to close dropdown */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setProfileOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-forest-floor/20 bg-white py-1 shadow-lg">
                    <div className="border-b border-forest-floor/10 px-4 py-2">
                      <p className="text-sm font-medium text-forest-floor">
                        {displayName}
                      </p>
                    </div>
                    <Link
                      href="/profile"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-forest-floor transition-colors hover:bg-forest-floor/5"
                    >
                      <UserIcon size={16} />
                      My Profile
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-forest-floor transition-colors hover:bg-forest-floor/5"
                    >
                      <SettingsIcon />
                      Settings
                    </Link>
                    <div className="border-t border-forest-floor/10">
                      <form action={logout}>
                        <button
                          type="submit"
                          className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-700 transition-colors hover:bg-red-50"
                        >
                          Sign out
                        </button>
                      </form>
                    </div>
                  </div>
                </>
              )}
            </div>
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
            {/* Profile header */}
            <Link
              href="/profile"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 rounded-md px-3 py-3 mb-1 transition-colors hover:bg-forest-floor"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-olive-branch text-sm font-bold text-wheat-cream">
                {initial}
              </span>
              <div>
                <p className="text-sm font-medium text-wheat-cream">
                  {displayName}
                </p>
                <p className="text-xs text-wheat-cream/60">View profile</p>
              </div>
            </Link>

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

            <Link
              href="/settings"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 rounded-md px-3 py-3 text-base font-medium text-wheat-cream/80 transition-colors hover:bg-forest-floor hover:text-wheat-cream"
            >
              <SettingsIcon />
              Settings
            </Link>

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
      <main className="flex-1 px-4 py-6 md:px-6 md:py-8">{children}</main>

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
