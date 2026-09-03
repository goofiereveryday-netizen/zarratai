import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { HistoryIcon, ChatIcon, FarmIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { getUserConsultations } from "@/lib/consultations";
import { getFarms } from "@/lib/farms";

/**
 * Farm History page — lists the signed-in user's consultations,
 * newest first. Clicking a consultation opens its conversation
 * in the Assistant via /assistant?c=<consultationId>.
 */
export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const [consultations, farms] = await Promise.all([
    getUserConsultations(),
    getFarms(),
  ]);

  // Build a farm-id → farm-name lookup so each history row can show
  // the associated farm without an extra query per row.
  const farmMap = new Map(farms.map((f) => [f.id, f.name]));
  const userName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null;

  return (
    <AppShell userName={userName}>
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight text-deep-moss">
          History
        </h1>
        <p className="mt-1 text-sm text-forest-floor/70">
          Your past consultations and their outcomes.
        </p>

        {consultations.length === 0 ? (
          <EmptyHistory />
        ) : (
          <ul className="mt-6 space-y-3">
            {consultations.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/assistant?c=${c.id}`}
                  className="group block rounded-xl border border-forest-floor/15 bg-wheat-cream-light px-4 py-4 transition-colors hover:bg-forest-floor/5 focus-visible:outline-olive-branch"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-base font-semibold text-deep-moss group-hover:text-olive-branch">
                          {c.title ?? "Untitled consultation"}
                        </h2>
                        <StatusBadge status={c.status} />
                      </div>
                      {farmMap.has(c.farm_id) && (
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-forest-floor/70">
                          <FarmIcon />
                          <span className="truncate">
                            {farmMap.get(c.farm_id)}
                          </span>
                        </p>
                      )}
                    </div>
                    {c.created_at && (
                      <time
                        dateTime={c.created_at}
                        className="shrink-0 text-xs text-forest-floor/50"
                      >
                        {formatDateTime(c.created_at)}
                      </time>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

/** Friendly empty state that guides the user to start a consultation. */
function EmptyHistory() {
  return (
    <section className="mt-6 rounded-xl border border-forest-floor/15 bg-wheat-cream-light px-6 py-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-olive-branch/10 text-olive-branch">
        <HistoryIcon />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-deep-moss">
        No history yet
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-forest-floor/70">
        Your consultations will appear here once you start talking to the
        assistant. Every conversation is saved against the crop it is about.
      </p>
      <Link
        href="/assistant"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-harvest-copper px-5 py-3 text-base font-semibold text-wheat-cream transition-colors hover:bg-harvest-copper/90 focus-visible:outline-citron-beam"
      >
        <ChatIcon />
        Start a consultation
      </Link>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full bg-olive-branch/10 px-2.5 py-0.5 text-xs font-medium text-olive-branch">
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-forest-floor/10 px-2.5 py-0.5 text-xs font-medium text-forest-floor/60">
      Completed
    </span>
  );
}

/**
 * Formats an ISO timestamp into a short human-readable string.
 * Shows time only for today's entries, date only for older ones.
 */
function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
