import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ConsultationChat } from "@/components/consultation-chat";
import { FarmIcon, HistoryIcon, ChatIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { getSelectedFarm, getFarmById, type Farm } from "@/lib/farms";
import {
  getActiveConsultation,
  getConsultationMessages,
  getConsultationById,
  type Consultation,
  type ConsultationMessage,
} from "@/lib/consultations";

export default async function AssistantPage(
  props: PageProps<"/assistant">
) {
  const searchParams = await props.searchParams;
  const consultationId =
    typeof searchParams?.c === "string" ? searchParams.c : null;

  // The assistant is only useful for signed-in users; send everyone else
  // to the login page first.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // When a specific consultation is requested (from Farm History),
  // load it and its farm directly — bypassing the selected-farm lookup.
  if (consultationId) {
    const consultation = await getConsultationById(consultationId);
    if (consultation) {
      const farm = await getFarmById(consultation.farm_id);
      const messages = await getConsultationMessages(consultation.id);
      return (
        <AppShell>
          <AssistantContent
            farm={farm}
            consultation={consultation}
            messages={messages}
            specificConsultation
          />
        </AppShell>
      );
    }
    // Consultation not found or RLS blocked — fall through to default.
  }

  const selectedFarm = await getSelectedFarm();

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight text-deep-moss">
          Assistant
        </h1>
        <p className="mt-1 text-sm text-forest-floor/70">
          Describe the problem. Know what to do next.
        </p>

        {selectedFarm ? (
          <>
            {/* Selected farm context — every consultation is saved
                against this farm */}
            <section
              className="mt-4 rounded-lg border border-forest-floor/20 bg-wheat-cream-light px-4 py-3"
              aria-label="Selected farm"
            >
              <div className="flex items-center gap-2 text-sm text-forest-floor">
                <FarmIcon />
                <span className="font-medium">Farm:</span>
                <span className="truncate font-medium text-deep-moss">
                  {selectedFarm.name}
                </span>
                <Link
                  href="/farms"
                  className="ml-auto shrink-0 text-sm font-medium text-olive-branch underline-offset-2 hover:underline focus-visible:outline-olive-branch"
                >
                  Change farm
                </Link>
              </div>
              <p className="mt-1 pl-7 text-sm text-forest-floor/70">
                {selectedFarm.area} acre{selectedFarm.area === 1 ? "" : "s"} ·{" "}
                {selectedFarm.crop}
                {selectedFarm.variety ? ` (${selectedFarm.variety})` : ""} ·{" "}
                {selectedFarm.district}, {selectedFarm.tehsil}
              </p>
            </section>

            <ConsultationFlow farmId={selectedFarm.id} />
          </>
        ) : (
          <NoFarmSelected />
        )}
      </div>
    </AppShell>
  );
}

/**
 * Renders the assistant body for a specific consultation (loaded from
 * Farm History). Shows the farm banner, a back link, and either the
 * interactive chat (active) or a read-only transcript (completed).
 */
function AssistantContent({
  farm,
  consultation,
  messages,
  specificConsultation,
}: {
  farm: Farm | null;
  consultation: Consultation;
  messages: ConsultationMessage[];
  specificConsultation: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href="/history"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-olive-branch underline-offset-2 hover:underline focus-visible:outline-olive-branch"
      >
        ← Back to history
      </Link>

      <h1 className="text-2xl font-bold tracking-tight text-deep-moss">
        {consultation.title ?? "Consultation"}
      </h1>

      {farm && (
        <section
          className="mt-3 rounded-lg border border-forest-floor/20 bg-wheat-cream-light px-4 py-3"
          aria-label="Associated farm"
        >
          <div className="flex items-center gap-2 text-sm text-forest-floor">
            <FarmIcon />
            <span className="font-medium">Farm:</span>
            <span className="truncate font-medium text-deep-moss">
              {farm.name}
            </span>
            <Link
              href="/farms"
              className="ml-auto shrink-0 text-sm font-medium text-olive-branch underline-offset-2 hover:underline focus-visible:outline-olive-branch"
            >
              Change farm
            </Link>
          </div>
        </section>
      )}

      {consultation.status === "active" ? (
        <div className="mt-4">
          <ConsultationChat
            key={consultation.id}
            consultation={consultation}
            messages={messages}
          />
        </div>
      ) : (
        <ReadOnlyConsultation
          consultation={consultation}
          messages={messages}
        />
      )}
    </div>
  );
}

/**
 * Displays a completed consultation's messages in read-only mode.
 * No composer, no "new consultation" button — just the transcript
 * and a link back to the active Assistant.
 */
function ReadOnlyConsultation({
  consultation,
  messages,
}: {
  consultation: Consultation;
  messages: ConsultationMessage[];
}) {
  return (
    <section aria-label="Past consultation" className="mt-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-forest-floor/10 px-2.5 py-0.5 text-xs font-medium text-forest-floor/60">
          Completed
        </span>
        {consultation.created_at && (
          <span className="text-xs text-forest-floor/50">
            {new Date(consultation.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        )}
      </div>

      <div role="log" aria-label="Conversation" className="flex flex-col gap-3 pt-1">
        {messages.length === 0 ? (
          <p className="text-sm text-forest-floor/60">
            No messages in this consultation.
          </p>
        ) : (
          messages.map((message) => {
            const isUser = message.role === "user";
            return (
              <div
                key={message.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-base leading-relaxed ${
                    isUser
                      ? "rounded-tr-sm bg-harvest-copper text-wheat-cream"
                      : "rounded-tl-sm border border-forest-floor/10 bg-wheat-cream-light text-deep-moss"
                  }`}
                >
                  {message.content ?? ""}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-6 border-t border-forest-floor/15 pt-4">
        <Link
          href="/assistant"
          className="inline-flex items-center gap-2 rounded-lg bg-harvest-copper px-5 py-3 text-base font-semibold text-wheat-cream transition-colors hover:bg-harvest-copper/90 focus-visible:outline-citron-beam"
        >
          <ChatIcon />
          Start a new consultation
        </Link>
      </div>
    </section>
  );
}

/**
 * Loads the active consultation and its messages for the selected farm.
 * Keyed on the farm id so switching farms loads the other farm's
 * conversation.
 */
async function ConsultationFlow({ farmId }: { farmId: string }) {
  const consultation = await getActiveConsultation(farmId);
  const messages = consultation
    ? await getConsultationMessages(consultation.id)
    : [];

  return (
    <div className="mt-4">
      <ConsultationChat
        key={farmId}
        consultation={consultation}
        messages={messages}
      />
    </div>
  );
}

/** Blocks consultation start when no farm is selected. */
function NoFarmSelected() {
  return (
    <section className="mt-6 rounded-xl border border-forest-floor/15 bg-wheat-cream-light px-6 py-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-olive-branch/10 text-olive-branch">
        <FarmIcon />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-deep-moss">
        No farm selected
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-forest-floor/70">
        Select a farm before starting a consultation. Every consultation is
        saved against the farm it is about.
      </p>
      <Link
        href="/farms"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-harvest-copper px-5 py-3 text-base font-semibold text-wheat-cream transition-colors hover:bg-harvest-copper/90 focus-visible:outline-citron-beam"
      >
        Go to My Farms
      </Link>
    </section>
  );
}
