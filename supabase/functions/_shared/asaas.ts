// Helpers compartilhados para integração com o Asaas (token por empresa)
export const asaasCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...asaasCors, "Content-Type": "application/json" },
  });

export interface AsaasSettings {
  owner_id: string;
  api_key: string;
  ambiente: string;
  webhook_token: string;
  active: boolean;
  boleto_days: number;
}

export const asaasBase = (ambiente: string) =>
  ambiente === "producao" || ambiente === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";

export async function asaasFetch(
  settings: Pick<AsaasSettings, "api_key" | "ambiente">,
  path: string,
  init: RequestInit = {},
) {
  const url = `${asaasBase(settings.ambiente)}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: settings.api_key,
      "User-Agent": "VortisGestao",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg =
      data?.errors?.map((e: any) => e.description).join(" | ") ||
      data?.message ||
      `Asaas retornou ${res.status}`;
    console.error(`[asaas] ${init.method || "GET"} ${path} -> ${res.status}: ${text}`);
    throw new Error(msg);
  }
  return data;
}

export const onlyDigits = (v: string) => (v || "").replace(/\D/g, "");
