import { isNumericCNPJ, cleanCNPJ } from "@/lib/validators";

export interface CnpjData {
  name: string;
  email: string;
  phone: string;
  zip_code: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  status?: string;
}

function formatCepStr(cep: string) {
  const d = (cep || "").replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : cep || "";
}

function formatPhoneStr(ddd: string, num: string) {
  const d = `${ddd || ""}${num || ""}`.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

export async function fetchCnpjData(cnpj: string): Promise<CnpjData> {
  const clean = cleanCNPJ(cnpj);
  if (clean.length !== 14) throw new Error("CNPJ deve ter 14 caracteres");

  // CNPJ alfanumérico (vigência jul/2026) ainda não é suportado pelas
  // APIs públicas (BrasilAPI/ReceitaWS). Avisa e deixa preenchimento manual.
  if (!isNumericCNPJ(clean)) {
    throw new Error(
      "Consulta automática ainda não disponível para CNPJ alfanumérico. Preencha os dados manualmente."
    );
  }

  // BrasilAPI (primary)
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
    if (res.ok) {
      const d = await res.json();
      return {
        name: d.razao_social || d.nome_fantasia || "",
        email: d.email || "",
        phone: d.ddd_telefone_1 ? formatPhoneStr("", d.ddd_telefone_1) : "",
        zip_code: formatCepStr(d.cep || ""),
        street: d.logradouro || "",
        number: d.numero || "",
        complement: d.complemento || "",
        neighborhood: d.bairro || "",
        city: d.municipio || "",
        state: (d.uf || "").toUpperCase(),
        status: d.descricao_situacao_cadastral,
      };
    }
  } catch {
    // fall through
  }

  // ReceitaWS fallback
  const res2 = await fetch(`https://receitaws.com.br/v1/cnpj/${clean}`);
  if (!res2.ok) throw new Error("Não foi possível consultar o CNPJ");
  const d = await res2.json();
  if (d.status === "ERROR") throw new Error(d.message || "CNPJ não encontrado");
  return {
    name: d.nome || d.fantasia || "",
    email: d.email || "",
    phone: d.telefone ? formatPhoneStr("", d.telefone.split("/")[0]) : "",
    zip_code: formatCepStr(d.cep || ""),
    street: d.logradouro || "",
    number: d.numero || "",
    complement: d.complemento || "",
    neighborhood: d.bairro || "",
    city: d.municipio || "",
    state: (d.uf || "").toUpperCase(),
    status: d.situacao,
  };
}
