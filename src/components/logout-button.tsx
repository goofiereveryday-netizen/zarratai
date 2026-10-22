"use client";

import { useState } from "react";
import { logout } from "@/lib/auth/client-auth";

export function LogoutButton({
  className,
}: {
  className?: string;
}) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await logout();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={className}
    >
      {pending ? "Signing out..." : "Sign out"}
    </button>
  );
}
