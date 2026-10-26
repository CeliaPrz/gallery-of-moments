import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { signOut, navigate } = vi.hoisted(() => ({
  signOut: vi.fn(async () => ({ error: null })),
  navigate: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signOut } },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

import { AccountMenu } from "@/components/account-menu";

function renderMenu() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AccountMenu fullName="Laurent Fabre" />
    </QueryClientProvider>,
  );
}

describe("Account menu", () => {
  beforeEach(() => {
    signOut.mockClear();
    navigate.mockClear();
  });

  it("opens a submenu with a sign-out entry when the account icon is clicked", () => {
    renderMenu();

    expect(screen.queryByRole("menuitem", { name: /Se déconnecter/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Compte" }));

    expect(screen.getByRole("menuitem", { name: /Se déconnecter/i })).toBeInTheDocument();
    expect(screen.getByText("Laurent Fabre")).toBeInTheDocument();
  });

  it("signs the user out and sends them to the login page", async () => {
    renderMenu();

    fireEvent.click(screen.getByRole("button", { name: "Compte" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Se déconnecter/i }));

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(navigate).toHaveBeenCalledWith({ to: "/auth", replace: true });
  });

  it("closes the submenu without signing out when Escape is pressed", () => {
    renderMenu();

    fireEvent.click(screen.getByRole("button", { name: "Compte" }));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menuitem", { name: /Se déconnecter/i })).toBeNull();
    expect(signOut).not.toHaveBeenCalled();
  });
});
