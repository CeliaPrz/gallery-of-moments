import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { MaterialIcon } from "@/components/material-icon";
import { supabase } from "@/integrations/supabase/client";

export function AccountMenu({ fullName, isAdmin }: { fullName: string; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    setOpen(false);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Compte"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-secondary hover:bg-surface-container-high"
      >
        <MaterialIcon name="person" className="text-[20px]" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-2 shadow-lg"
        >
          <div className="border-b border-outline-variant/40 px-3 pb-2 pt-1">
            <p className="truncate font-body-md text-[13px] text-on-surface">{fullName || "—"}</p>
            <p className="font-audit-trail text-[11px] text-secondary">
              {isAdmin ? "Administratrice" : "Consultation seule"}
            </p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 font-body-md text-[13px] text-on-surface hover:bg-surface-container-high"
          >
            <MaterialIcon name="logout" className="text-[18px] text-secondary" />
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
