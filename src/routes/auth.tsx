import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { MaterialIcon } from "@/components/material-icon";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — LUR Gestion d'actifs" },
      {
        name: "description",
        content:
          "Portail institutionnel de gestion d'actifs immobiliers. Accès réservé aux investisseurs et à l'équipe de gestion.",
      },
      { property: "og:title", content: "Connexion — LUR Gestion d'actifs" },
      {
        property: "og:description",
        content:
          "Portail institutionnel de gestion d'actifs immobiliers. Accès réservé aux investisseurs et à l'équipe de gestion.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setPending(false);
    if (error) {
      toast.error("Connexion impossible", { description: error.message });
      return;
    }
    navigate({ to: "/" });
  }

  return (
    <main className="min-h-screen w-full bg-background">
      <div className="flex min-h-screen w-full flex-col lg:flex-row">
        {/* Panneau d'autorité */}
        <div className="relative flex w-full flex-col justify-between overflow-hidden bg-primary-container p-8 text-on-primary sm:p-12 lg:w-[40%] lg:p-16">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.04]">
            <svg
              className="h-[880px] w-[880px] text-surface-container-lowest"
              fill="none"
              stroke="currentColor"
              stroke-width="1.2"
              viewBox="0 0 600 600"
            >
              <circle cx="300" cy="300" r="280" stroke-dasharray="4 8" />
              <circle cx="300" cy="300" r="210" />
              <circle cx="300" cy="300" r="140" stroke-dasharray="2 4" />
              <line x1="20" x2="580" y1="300" y2="300" />
              <line x1="300" x2="300" y1="20" y2="580" />
              <rect height="240" width="240" x="180" y="180" />
              <rect height="140" width="140" x="230" y="230" />
              <line x1="180" x2="420" y1="180" y2="420" />
              <line x1="420" x2="180" y1="180" y2="420" />
            </svg>
          </div>
          <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-surface-tint opacity-10 blur-3xl" />

          <div className="relative z-10 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-lowest/10 p-2 shadow-sm backdrop-blur-sm">
              <MaterialIcon name="apartment" className="text-[22px] text-secondary-fixed" />
            </div>
            <div className="flex flex-col">
              <span className="font-headline-sm text-sm font-bold uppercase tracking-[0.35em] text-surface-container-lowest">
                L U R
              </span>
              <span className="font-audit-trail text-[10px] uppercase tracking-wider text-on-primary-container">
                Gestion de patrimoine immobilier
              </span>
            </div>
          </div>

          <div className="relative z-10 my-auto max-w-md py-12">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-surface-container-lowest/10 px-3 py-1 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-secondary-fixed" />
              <span className="font-label-sm text-[10px] uppercase tracking-wider text-secondary-fixed">
                Gestion d'actifs tertiaires
              </span>
            </div>
            <h1 className="mb-6 font-display-lg leading-[1.2] tracking-tight">
              Votre portefeuille immobilier, à jour et traçable.
            </h1>
          </div>

          <div className="relative z-10 flex items-center gap-3 pt-6 text-on-primary-container">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest/10">
              <MaterialIcon name="shield_lock" className="text-[17px] text-secondary-fixed" />
            </div>
            <p className="font-audit-trail text-xs leading-tight">
              Accès réservé aux investisseurs et à l'équipe de gestion.
            </p>
          </div>
        </div>

        {/* Panneau d'authentification */}
        <div className="relative flex min-h-screen w-full flex-col items-center justify-between bg-surface-container-low px-4 py-8 sm:p-12 lg:w-[60%] lg:p-16">
          <div className="my-auto w-full max-w-[420px] rounded-2xl bg-surface-container-lowest p-8 shadow-xl transition-all duration-300 sm:p-10">
            <div className="mb-8">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-high text-primary">
                <MaterialIcon name="corporate_fare" className="text-[20px]" />
              </div>
              <h2 className="mb-1.5 font-headline-lg text-2xl font-bold tracking-tight text-primary">
                Connexion
              </h2>
              <p className="font-body-md text-sm text-secondary">Portail institutionnel sécurisé</p>
            </div>

            <form className="space-y-5" novalidate onSubmit={submit}>
              <div>
                <label
                  className="mb-2 block font-label-md text-[11px] uppercase tracking-wider text-secondary"
                  htmlFor="email"
                >
                  Adresse e-mail
                </label>
                <div className="relative">
                  <input
                    className="h-12 w-full rounded-xl bg-surface-container-lowest px-4 font-body-md text-on-surface shadow-sm transition-all placeholder:text-outline/70 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-bright"
                    id="email"
                    placeholder="nom@societe-gestion.com"
                    required
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  <MaterialIcon
                    name="alternate_email"
                    className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[20px] text-outline"
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label
                    className="font-label-md text-[11px] uppercase tracking-wider text-secondary"
                    htmlFor="password"
                  >
                    Mot de passe
                  </label>
                  <button
                    type="button"
                    className="font-label-sm text-xs text-primary hover:text-primary-container hover:underline"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
                <div className="relative">
                  <input
                    className="h-12 w-full rounded-xl bg-surface-container-lowest pl-4 pr-11 font-body-md tracking-wider text-on-surface shadow-sm transition-all placeholder:text-outline/70 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-bright"
                    id="password"
                    placeholder="••••••••••••"
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    aria-label="Afficher ou masquer le mot de passe"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-outline transition-colors hover:text-primary focus:outline-none"
                    type="button"
                    onClick={() => setShowPassword((shown) => !shown)}
                  >
                    <MaterialIcon
                      name={showPassword ? "visibility_off" : "visibility"}
                      className="text-[20px] align-middle"
                    />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex cursor-pointer items-center gap-2 select-none">
                  <input
                    className="h-4 w-4 rounded bg-surface-container-high text-primary focus:ring-primary"
                    type="checkbox"
                  />
                  <span className="font-body-sm text-xs text-secondary">Mémoriser ce poste</span>
                </label>
              </div>

              <button
                className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-headline-sm text-sm font-semibold text-on-primary shadow-md transition-all hover:bg-primary-container active:scale-[0.99] disabled:opacity-60"
                disabled={pending}
                type="submit"
              >
                <span>{pending ? "Connexion…" : "Se connecter"}</span>
                <MaterialIcon name="arrow_forward" className="text-[18px]" />
              </button>

              <div className="mt-4 flex items-center gap-2.5 rounded-lg bg-surface-container-high/60 p-3">
                <MaterialIcon
                  name="verified_user"
                  className="shrink-0 text-[17px] text-surface-tint"
                />
                <p className="font-body-sm text-xs leading-snug text-secondary">
                  Vous accédez uniquement aux actifs de votre portefeuille mandataire.
                </p>
              </div>
            </form>

            <div className="mt-6 pt-5 text-center">
              <p className="font-audit-trail text-xs text-secondary">
                Pas d'inscription en ligne. Les accès sont créés par votre gestionnaire.
              </p>
            </div>
          </div>

          <div className="flex w-full max-w-[420px] items-center justify-between gap-2 pt-4 text-center font-audit-trail text-xs text-outline">
            <span>LUR</span>
          </div>
        </div>
      </div>
    </main>
  );
}
