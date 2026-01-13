import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_PDF_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BASE64_LENGTH = Math.ceil((MAX_PDF_BYTES / 3) * 4) + 16;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isPdfHeader = (bytes: Uint8Array) =>
  bytes.length >= 4 &&
  bytes[0] === 0x25 &&
  bytes[1] === 0x50 &&
  bytes[2] === 0x44 &&
  bytes[3] === 0x46;

const safeJson = (s: string) => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

const parseJsonArrayFromModel = (raw: string) => {
  const cleaned = raw.replace(/```json\n?|```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Modelo não retornou um array JSON válido");
  }
  const slice = cleaned.slice(start, end + 1);
  const parsed = JSON.parse(slice);
  if (!Array.isArray(parsed)) throw new Error("Saída do modelo não é um array");
  return parsed;
};

const coerceNumber = (v: unknown): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(
      v
        .replace(/R\$\s*/gi, "")
        .replace(/\./g, "")
        .replace(/,/g, ".")
        .replace(/[^0-9.-]/g, "")
        .trim(),
    );
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const normalizeItem = (item: any) => {
  const description = typeof item?.description === "string" ? item.description.trim() : "";
  const unit = typeof item?.unit === "string" && item.unit.trim() ? item.unit.trim() : "UN";
  const supplier = typeof item?.supplier === "string" && item.supplier.trim() ? item.supplier.trim() : null;
  const material_price = coerceNumber(item?.material_price);
  const labor_price = coerceNumber(item?.labor_price);
  const price = coerceNumber(item?.price) || material_price + labor_price;
  const keywords = Array.isArray(item?.keywords)
    ? item.keywords.filter((k: any) => typeof k === "string").map((k: string) => k.trim()).filter(Boolean)
    : [];

  return { description, unit, supplier, material_price, labor_price, price, keywords };
};

const normalizeTextKey = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const dedupeItems = (items: Array<ReturnType<typeof normalizeItem>>) => {
  const seen = new Set<string>();
  const out: typeof items = [];

  for (const it of items) {
    const key = `${normalizeTextKey(it.description)}|${normalizeTextKey(it.unit || "UN")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }

  return out;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized - Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      console.error("Authentication failed:", authError?.message || "No user found");
      return new Response(JSON.stringify({ error: "Unauthorized - Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Authenticated user: ${user.id}`);

    const contentType = req.headers.get("content-type") ?? "";
    const isMultipart = contentType.includes("multipart/form-data");
    const isJson = contentType.includes("application/json");

    let pdfBytes: Uint8Array | null = null;

    if (isMultipart) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return new Response(JSON.stringify({ error: "Invalid input: missing file field" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (file.size > MAX_PDF_BYTES) {
        return new Response(JSON.stringify({ error: "PDF file is too large. Maximum size is 5MB." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      pdfBytes = new Uint8Array(await file.arrayBuffer());
    } else if (isJson) {
      const body = await req.json().catch(() => ({} as any));
      const base64 = body?.pdfBase64;
      if (!base64 || typeof base64 !== "string") {
        return new Response(JSON.stringify({ error: "Invalid input: pdfBase64 is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (base64.length > MAX_PDF_BASE64_LENGTH) {
        return new Response(JSON.stringify({ error: "PDF file is too large. Maximum size is 5MB." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        pdfBytes = bytes;
      } catch {
        return new Response(JSON.stringify({ error: "Invalid PDF format: not valid base64 encoding" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const bytes = new Uint8Array(await req.arrayBuffer());
      if (bytes.byteLength === 0) {
        return new Response(JSON.stringify({ error: "Invalid input: empty request body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!contentType.includes("application/octet-stream") && !isPdfHeader(bytes)) {
        return new Response(JSON.stringify({ error: "Unsupported content-type. Send PDF bytes or multipart/form-data." }), {
          status: 415,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (bytes.byteLength > MAX_PDF_BYTES) {
        return new Response(JSON.stringify({ error: "PDF file is too large. Maximum size is 5MB." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      pdfBytes = bytes;
    }

    if (!pdfBytes) {
      return new Response(JSON.stringify({ error: "Invalid input: PDF bytes missing" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isPdfHeader(pdfBytes)) {
      return new Response(JSON.stringify({ error: "Invalid input: body does not look like a PDF" }), {
        status: 415,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    console.log(`Extracting data from PDF using AI for user: ${user.id}...`);

    // Convert to base64
    const pdfBase64 = encodeBase64(new Uint8Array(pdfBytes).buffer as ArrayBuffer);

    const systemPrompt = `Você é um extrator de dados de tabelas de materiais em PDF com ALTA PRECISÃO.
IMPORTANTE: Extraia TODOS os itens da tabela - TODAS AS PÁGINAS do documento PDF.

⚠️ ATENÇÃO MÁXIMA À ORTOGRAFIA:
- Copie os nomes dos materiais EXATAMENTE como aparecem no documento
- NÃO corrija, altere ou "interprete" os nomes - transcreva-os LITERALMENTE

Retorne um array JSON com objetos contendo:
- description (texto)
- unit (texto, default "UN")
- supplier (texto|null)
- material_price (número)
- labor_price (número)
- price (número)
- keywords (array)

REGRAS CRÍTICAS:
1) EXTRAIA TODOS OS ITENS DE TODAS AS PÁGINAS - não limite a quantidade
2) TRANSCREVA OS NOMES EXATAMENTE como aparecem
3) Normalize números com vírgula/ponto (R$ 12,90 → 12.9)
4) Se preço vazio, use 0
5) Retorne APENAS o array JSON, sem explicações
6) O PDF pode ter múltiplas páginas - extraia TUDO`;

    const callAi = async (model: string) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000); // 2 min timeout for large PDFs

      try {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: [
                  { type: "text", text: "Extraia TODOS os itens deste documento PDF (todas as páginas) em formato JSON:" },
                  {
                    type: "image_url",
                    image_url: { url: `data:application/pdf;base64,${pdfBase64}` },
                  },
                ],
              },
            ],
            temperature: 0,
          }),
        });

        const raw = await resp.text();

        if (!resp.ok) {
          console.error("AI API error:", resp.status, raw);
          if (resp.status === 429) return { kind: "rate_limit" as const, error: "Rate limit exceeded. Please try again later." };
          if (resp.status === 402) return { kind: "unavailable" as const, error: "AI service unavailable. Please try again later." };
          throw new Error(`AI API error: ${resp.status} ${raw || ""}`.trim());
        }

        if (!raw.trim()) throw new Error("AI API returned an empty response body");

        const data = safeJson(raw);
        const extractedText = data?.choices?.[0]?.message?.content;
        if (!extractedText || typeof extractedText !== "string") throw new Error("AI response missing content");

        return { kind: "ok" as const, extractedText };
      } finally {
        clearTimeout(timeout);
      }
    };

    // Use gemini-2.5-pro for better multi-page PDF handling, with fallbacks
    const modelsToTry = ["google/gemini-2.5-pro", "google/gemini-2.5-flash", "google/gemini-3-flash-preview"];
    let extractedText: string | null = null;
    let lastErr: unknown = null;

    for (const model of modelsToTry) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`AI call: model=${model} attempt=${attempt}`);
          const res = await callAi(model);
          if (res.kind === "rate_limit") {
            return new Response(JSON.stringify({ error: res.error }), {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (res.kind === "unavailable") {
            return new Response(JSON.stringify({ error: res.error }), {
              status: 503,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          extractedText = res.extractedText;
          break;
        } catch (err) {
          lastErr = err;
          console.error(`AI call failed: model=${model} attempt=${attempt}`, err);
          if (attempt < 2) await sleep(500 * attempt);
        }
      }
      if (extractedText) break;
    }

    if (!extractedText) throw (lastErr instanceof Error ? lastErr : new Error("Failed to extract PDF data"));

    console.log("AI response received for user:", user.id);

    const rawItems = parseJsonArrayFromModel(extractedText).map(normalizeItem).filter((it) => it.description);
    
    // Deduplicate items (same description + unit)
    const items = dedupeItems(rawItems);

    if (items.length === 0) throw new Error("No valid items extracted from PDF");

    console.log(`Successfully extracted ${items.length} items (${rawItems.length} before dedupe) for user: ${user.id}`);

    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in extract-pdf-data function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
