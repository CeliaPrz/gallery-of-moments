import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { MaterialIcon } from "@/components/material-icon";
import { supabase } from "@/integrations/supabase/client";
import { getSidebarAssets, type SidebarAssetGroup } from "@/lib/lur.functions";

function AssetsMenu({
  item,
  groups,
  showGroups,
  currentPath,
  onNavigate,
}: {
  item: NavItem;
  groups: SidebarAssetGroup[];
  showGroups: boolean;
  currentPath: string;
  onNavigate: () => void;
}) {
  const onAssetPage = currentPath.startsWith("/actifs/");
  const [open, setOpen] = useState(onAssetPage);
  const isOpen = open || onAssetPage;
  const total = groups.reduce((n, g) => n + g.assets.length, 0);

  return (
    <div>
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setOpen((v) => (onAssetPage ? true : !v))}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 font-body-md text-[13px] text-sidebar-foreground/80 transition-colors hover:bg-surface-container-lowest/10 hover:text-sidebar-foreground"
      >
        <MaterialIcon name={item.icon} className="text-[20px]" />
        <span className="flex-1 text-left">{item.label}</span>
        <MaterialIcon
          name="expand_more"
          className={`text-[18px] transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div className="mt-1 max-h-64 space-y-0.5 overflow-y-auto">
          {total === 0 ? (
            <p className="py-1.5 pl-11 font-body-sm text-[12px] text-on-primary-container">Aucun actif</p>
          ) : (
            groups.map((group) => (
              <div key={group.investorName ?? "_"}>
                {showGroups && group.investorName && (
                  <p className="pb-1 pl-11 pt-2 font-label-sm text-[10px] uppercase tracking-wider text-on-primary-container">
                    {group.investorName}
                  </p>
                )}
                {group.assets.map((asset) => {
                  const active = currentPath === `/actifs/${asset.id}`;
                  return (
                    <Link
                      key={asset.id}
                      to="/actifs/$assetId"
                      params={{ assetId: asset.id }}
                      onClick={onNavigate}
                      className={`block truncate rounded-lg py-1.5 pl-11 pr-3 font-body-sm text-[12px] transition-colors ${
                        active
                          ? "bg-secondary-fixed text-on-secondary-fixed"
                          : `${asset.exited ? "text-on-primary/45" : "text-on-primary/80"} hover:bg-[#DCE5DA]/10`
                      }`}
                    >
                      {asset.name}
                    </Link>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

type NavItem =
  | { label: string; icon: string; to: "/" | "/import" | "/rapports" }
  | { label: string; icon: string; anchor: "#actifs" }
  | { label: string; icon: string };

const INVESTOR_NAV: NavItem[] = [
  { label: "Tableau de bord", icon: "grid_view", to: "/" },
  { label: "Actifs", icon: "apartment", anchor: "#actifs" },
  { label: "Rapports", icon: "analytics" },
  { label: "Documents", icon: "folder_open" },
];

const ADMIN_NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Portefeuille",
    items: [
      { label: "Tableau de bord", icon: "dashboard", to: "/" },
      { label: "Actifs", icon: "domain", anchor: "#actifs" },
      { label: "Rapports", icon: "bar_chart" },
      { label: "Documents", icon: "folder_open" },
    ],
  },
  {
    group: "Administration",
    items: [
      { label: "Investisseurs", icon: "groups" },
      { label: "Import", icon: "upload_file", to: "/import" },
      { label: "Historique des imports", icon: "history" },
      { label: "Rapports admin", icon: "analytics", to: "/rapports" },
    ],
  },
];

function NavButton({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate: () => void;
}) {
  const classes = `flex w-full items-center gap-3 rounded-lg px-3 py-2 font-body-md text-[13px] transition-colors ${
    active
      ? "bg-secondary-fixed text-on-secondary-fixed"
      : "text-sidebar-foreground/80 hover:bg-surface-container-lowest/10 hover:text-sidebar-foreground"
  }`;

  if ("anchor" in item) {
    return (
      <a href={item.anchor} className={classes} onClick={onNavigate}>
        <MaterialIcon name={item.icon} className="text-[20px]" />
        <span>{item.label}</span>
      </a>
    );
  }

  if ("to" in item) {
    return (
      <Link to={item.to} className={classes} onClick={onNavigate}>
        <MaterialIcon name={item.icon} className="text-[20px]" />
        <span>{item.label}</span>
      </Link>
    );
  }

  return (
    <button type="button" className={`${classes} cursor-default`} onClick={onNavigate}>
      <MaterialIcon name={item.icon} className="text-[20px]" />
      <span>{item.label}</span>
    </button>
  );
}

export function LurShell({
  children,
  isAdmin,
  fullName,
  investorName,
  assetsCount,
  lastImportLabel,
}: {
  children: ReactNode;
  isAdmin: boolean;
  fullName: string;
  investorName: string;
  assetsCount: number | null;
  lastImportLabel: string | null;
}) {
  const [open, setOpen] = useState(false);
  const currentPath = useRouterState({ select: (router) => router.location.pathname });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const sidebarAssets = useQuery({
    queryKey: ["sidebar-assets"],
    queryFn: () => getSidebarAssets(),
    staleTime: 5 * 60 * 1000,
  });
  const assetGroups = sidebarAssets.data?.groups ?? [];
  const renderItem = (item: NavItem) =>
    "anchor" in item ? (
      <AssetsMenu
        key={item.label}
        item={item}
        groups={assetGroups}
        showGroups={isAdmin}
        currentPath={currentPath}
        onNavigate={() => setOpen(false)}
      />
    ) : (
      <NavButton
        key={item.label}
        item={item}
        active={"to" in item && currentPath === item.to}
        onNavigate={() => setOpen(false)}
      />
    );

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();


  return (
    <div className="min-h-screen bg-surface">
      <button
        type="button"
        aria-label="Afficher le menu"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-50 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-on-primary shadow-lg lg:hidden"
      >
        <MaterialIcon name="menu" className="text-[24px]" />
      </button>

      {open && (
        <button
          type="button"
          aria-label="Fermer le menu"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-sidebar-border p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-lowest/10">
            <MaterialIcon name="apartment" className="text-[20px] text-secondary-fixed" />
          </div>
          <div className="flex flex-col">
            <span className="font-headline-sm text-sm font-bold uppercase tracking-[0.35em] text-on-primary">
              L U R
            </span>
            <span className="font-audit-trail text-[10px] uppercase tracking-wider text-on-primary-container">
              Gestion d'actifs
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6">
          {isAdmin ? (
            ADMIN_NAV.map((section) => (
              <div key={section.group} className="mb-6">
                <p className="font-label-sm px-3 pb-2 text-[10px] uppercase tracking-[0.2em] text-on-primary-container">
                  {section.group}
                </p>
                <div className="space-y-1">
                  {section.items.map(renderItem)}
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-1">
              {INVESTOR_NAV.map(renderItem)}
            </div>
          )}
        </nav>

        <div className="border-t border-sidebar-border p-6">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-lowest/10 font-label-md text-[11px] text-secondary-fixed">
              {initials || <MaterialIcon name="person" className="text-[18px]" />}
            </div>
            <div className="min-w-0">
              <p className="truncate font-body-md text-[13px] text-sidebar-foreground">{fullName}</p>
              <p className="truncate font-audit-trail text-[11px] text-on-primary-container">
                {isAdmin ? "Administration" : investorName}
              </p>
            </div>
          </div>

          <div className="mb-3 flex items-center gap-2 rounded-lg bg-surface-container-lowest/10 px-3 py-2">
            <MaterialIcon name="visibility" className="text-[16px] text-secondary-fixed" />
            <span className="font-label-sm text-[10px] uppercase tracking-wider text-secondary-fixed">
              Consultation seule
            </span>
          </div>

          {isAdmin ? (
            <Link
              to="/import"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-2 rounded-lg bg-secondary-fixed px-3 py-2 font-label-md text-[12px] uppercase tracking-wider text-on-secondary-fixed"
            >
              <MaterialIcon name="upload_file" className="text-[18px]" />
              Importer un fichier
            </Link>
          ) : (
            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-sidebar-border px-3 py-2 font-label-md text-[12px] uppercase tracking-wider text-sidebar-foreground/80 hover:bg-surface-container-lowest/10"
            >
              <MaterialIcon name="logout" className="text-[18px]" />
              Se déconnecter
            </button>
          )}

          <p className="mt-3 font-audit-trail text-[11px] text-on-primary-container">
            {assetsCount != null ? `${assetsCount} actifs` : ""}
            {assetsCount != null && lastImportLabel ? " · " : ""}
            {lastImportLabel ? `Dernier import : ${lastImportLabel}` : ""}
          </p>
        </div>
      </aside>

      <div className="lg:pl-[280px]">{children}</div>
    </div>
  );
}

