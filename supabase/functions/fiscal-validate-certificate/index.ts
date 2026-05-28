import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import forge from "npm:node-forge@1.3.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

async function deriveKey(ownerId: string): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(SERVICE_ROLE_KEY + ":fiscal:" + ownerId);
  const hash = await crypto.subtle.digest("SHA-256", raw);
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptPassword(ownerId: string, password: string): Promise<string> {
  const key = await deriveKey(ownerId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(password));
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(cipher)));
  return `v1:${ivB64}:${ctB64}`;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { cert_base64, filename, password, settings } = body ?? {};

    if (!cert_base64 || !password || !filename) {
      return new Response(JSON.stringify({ error: "Certificado, nome do arquivo e senha são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Parse PFX with node-forge to validate password and extract metadata
    let subject = "";
    let expiresAt: string | null = null;
    try {
      const derBytes = base64ToBytes(cert_base64);
      const binary = String.fromCharCode(...derBytes);
      const p12Asn1 = forge.asn1.fromDer(binary);
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);

      const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const certBag = bags[forge.pki.oids.certBag]?.[0];
      if (!certBag?.cert) throw new Error("Certificado não encontrado no arquivo");

      const cert = certBag.cert;
      const cnAttr = cert.subject.getField("CN");
      subject = cnAttr?.value ?? "";
      expiresAt = cert.validity.notAfter.toISOString();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const friendly = msg.toLowerCase().includes("mac") || msg.toLowerCase().includes("password")
        ? "Senha do certificado inválida"
        : `Falha ao ler certificado: ${msg}`;
      return new Response(JSON.stringify({ error: friendly }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Upload certificate to private bucket using service role
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const certPath = `${user.id}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const certBytes = base64ToBytes(cert_base64);
    const { error: uploadErr } = await adminClient.storage
      .from("fiscal-certificates")
      .upload(certPath, certBytes, { contentType: "application/x-pkcs12", upsert: true });
    if (uploadErr) {
      return new Response(JSON.stringify({ error: `Falha ao armazenar certificado: ${uploadErr.message}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const encryptedPwd = await encryptPassword(user.id, password);

    const upsertPayload = {
      owner_id: user.id,
      cnpj: settings?.cnpj ?? "",
      ie: settings?.ie ?? "",
      regime_tributario: settings?.regime_tributario ?? "simples_nacional",
      csc_id: settings?.csc_id ?? "",
      csc_token: settings?.csc_token ?? "",
      cfop_default: settings?.cfop_default ?? "5102",
      csosn_default: settings?.csosn_default ?? "102",
      ambiente: settings?.ambiente ?? "homologacao",
      provider: settings?.provider ?? "focusnfe",
      provider_token: settings?.provider_token ?? "",
      certificate_path: certPath,
      certificate_filename: filename,
      certificate_password_encrypted: encryptedPwd,
      certificate_subject: subject,
      certificate_expires_at: expiresAt,
      certificate_valid: true,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertErr } = await adminClient
      .from("fiscal_settings")
      .upsert(upsertPayload, { onConflict: "owner_id" });

    if (upsertErr) {
      return new Response(JSON.stringify({ error: `Falha ao salvar configurações: ${upsertErr.message}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      success: true,
      subject,
      expires_at: expiresAt,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
