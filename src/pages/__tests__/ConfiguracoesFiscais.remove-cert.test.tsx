import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

// Mock role hook: user is Master
vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({ isMaster: true, loading: false, role: "master", effectiveUserId: "user-1" }),
}));

// Mock toast to observe success
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) },
}));

// Existing fiscal_settings row with certificate_path already NULL,
// but certificate_valid still true (the exact edge case we want covered).
const existingRow = {
  cnpj: "11.222.333/0001-81",
  ie: "12345",
  regime_tributario: "simples_nacional",
  csc_id: "",
  csc_token: "",
  cfop_default: "5102",
  csosn_default: "102",
  ambiente: "homologacao",
  provider: "focusnfe",
  provider_token: "tok",
  certificate_filename: "cert.pfx",
  certificate_subject: "CN=Empresa",
  certificate_expires_at: new Date(Date.now() + 90 * 86400_000).toISOString(),
  certificate_valid: true,
  certificate_path: null, // <- key precondition
};

let updatePayload: any = null;
let updateEqValue: any = null;
let updateError: any = null;

vi.mock("@/integrations/supabase/client", () => {
  const from = (_table: string) => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: existingRow, error: null }),
      }),
    }),
    update: (payload: any) => {
      updatePayload = payload;
      return {
        eq: (_col: string, val: any) => {
          updateEqValue = val;
          return Promise.resolve({ error: updateError });
        },
      };
    },
  });
  return {
    supabase: {
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } } }),
      },
      from,
    },
  };
});

// jsdom lacks window.confirm by default in some setups; force accept.
beforeEach(() => {
  updatePayload = null;
  updateEqValue = null;
  updateError = null;
  toastSuccess.mockReset();
  toastError.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

import ConfiguracoesFiscais from "@/pages/ConfiguracoesFiscais";

describe("ConfiguracoesFiscais - remove certificate", () => {
  it("removes the certificate successfully even when certificate_path is already null", async () => {
    render(<ConfiguracoesFiscais />);

    // Wait for the active certificate alert to render
    const removeBtn = await screen.findByRole("button", { name: /remover/i });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(updatePayload).not.toBeNull();
    });

    // Update should clear all certificate fields, including certificate_path
    expect(updatePayload).toMatchObject({
      certificate_path: null,
      certificate_filename: "",
      certificate_subject: "",
      certificate_expires_at: null,
      certificate_valid: false,
      certificate_password_encrypted: null,
    });
    expect(updateEqValue).toBe("user-1");

    // Success toast fires — no error path even though certificate_path was already null
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/removido/i));
    });
    expect(toastError).not.toHaveBeenCalled();

    // UI should no longer show the "Certificado ativo" alert
    await waitFor(() => {
      expect(screen.queryByText(/certificado ativo/i)).toBeNull();
    });
  });
});
