import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ConsultationChat } from "@/components/consultation-chat";
import { FarmIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { getSelectedFarm } from "@/lib/farms";
import {
  getActiveConsultation,
  getConsultationMessages,
} from "@/lib/consultations";

export default async function AssistantPage() {
  // The assistant is only useful for signed-in users; send everyone else
  // to the login page first.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
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
