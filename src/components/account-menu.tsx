import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { MaterialIcon } from "@/components/material-icon";
import { supabase } from "@/integrations/supabase/client";

export function AccountMenu({ fullName }: { fullName: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    setOpen(false);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Compte"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className={`flex h-9 w-9 items-center justify-center rounded-lg text-secondary hover:bg-surface-container-high ${
          open ? "bg-surface-container-high" : ""
        }`}
      >
        <MaterialIcon name="person" className="text-[20px]" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-2 shadow-lg"
        >
          <div className="flex items-center gap-3 border-b border-outline-variant/40 px-2 pb-3 pt-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-high font-label-md text-[11px] text-on-surface-variant">
              {fullName
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part.charAt(0))
                .join("")
                .toUpperCase() || <MaterialIcon name="person" className="text-[18px]" />}
            </div>
            <p className="min-w-0 truncate font-body-md text-[13px] text-on-surface">
              {fullName || "Mon compte"}
            </p>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            disabled={busy}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left font-body-md text-[13px] text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-60"
          >
            <MaterialIcon name="logout" className="text-[18px] text-secondary" />
            <span>Se déconnecter</span>
          </button>
        </div>
      )}
    </div>
  );
}
