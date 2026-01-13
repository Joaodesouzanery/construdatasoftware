import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  decode as decodeBase64,
  encode as encodeBase64,
} from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocument } from "https://esm.sh/pdfjs-serverless@1.0.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Limite de tamanho do PDF (em bytes). Importante: evitar base64 no client, pois aumenta ~33%.
const MAX_PDF_BYTES = 5 * 1024 * 1024;
// Tamanho máximo aproximado do base64 gerado a partir de MAX_PDF_BYTES
const MAX_PDF_BASE64_LENGTH = Math.ceil((MAX_PDF_BYTES / 3) * 4) + 16;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isPdfHeader = (bytes: Uint8Array) =>
  bytes.length >= 4 &&
  bytes[0] === 0x25 && // %
  bytes[1] === 0x50 && // P
  bytes[2] === 0x44 && // D
  bytes[3] === 0x46; // F

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

  return {
    description,
    unit,
    supplier,
    material_price,
    labor_price,
    price,
    keywords,
  };
};

const extractPdfTextPages = async (pdfBytes: Uint8Array): Promise<string[]> => {
  // pdfjs-serverless é otimizado para ambientes serverless (Deno) e costuma ser bem mais rápido
  // do que mandar o PDF inteiro para o modelo multimodal.
  const doc = await getDocument({ data: pdfBytes, useSystemFonts: true }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = (content.items || [])
      .map((it: any) => (typeof it?.str === "string" ? it.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push(pageText);
  }

  return pages;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
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
    let pdfBase64: string | null = null; // só usamos no fallback multimodal

    // Aceita 3 formatos:
    // 1) application/octet-stream: corpo = bytes do PDF (recomendado)
    // 2) multipart/form-data: campo "file"
    // 3) application/json: { pdfBase64 }
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
        console.error(`PDF too large (file): ${file.size} (max: ${MAX_PDF_BYTES})`);
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
        console.error(`PDF too large (base64): ${base64.length} (max: ${MAX_PDF_BASE64_LENGTH})`);
        return new Response(JSON.stringify({ error: "PDF file is too large. Maximum size is 5MB." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // decodifica apenas aqui (mais barato do que mandar base64 para IA)
      try {
        pdfBytes = decodeBase64(base64);
        pdfBase64 = base64;
      } catch {
        return new Response(JSON.stringify({ error: "Invalid PDF format: not valid base64 encoding" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Fallback robusto: se vier sem content-type (ou diferente), tratamos como bytes.
      const bytes = new Uint8Array(await req.arrayBuffer());
      if (bytes.byteLength === 0) {
        console.error("Empty body received");
        return new Response(JSON.stringify({ error: "Invalid input: empty request body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!contentType.includes("application/octet-stream") && !isPdfHeader(bytes)) {
        console.error("Unsupported content-type:", contentType);
        return new Response(JSON.stringify({ error: "Unsupported content-type. Send PDF bytes or multipart/form-data." }), {
          status: 415,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (bytes.byteLength > MAX_PDF_BYTES) {
        console.error(`PDF too large (bytes): ${bytes.byteLength} (max: ${MAX_PDF_BYTES})`);
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
      // alguns PDFs podem ter bytes iniciais com BOM/whitespace, mas na prática esse check pega muitos erros
      console.error("Body is not a PDF (missing %PDF header)");
      return new Response(JSON.stringify({ error: "Invalid input: body does not look like a PDF" }), {
        status: 415,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    console.log(`Extracting data from PDF using AI for user: ${user.id}...`);

    // 1) CAMINHO RÁPIDO: extrai texto com pdfjs e envia só texto para a IA (bem mais rápido/estável)
    let items: any[] | null = null;
    try {
      const t0 = Date.now();
      const pages = await extractPdfTextPages(pdfBytes);
      const elapsed = Date.now() - t0;
      console.log(`PDF text extracted: pages=${pages.length} ms=${elapsed}`);

      const nonEmpty = pages.map((p) => p.trim()).filter(Boolean);
      if (nonEmpty.length > 0) {
        const systemPromptText = `Você é um extrator de itens de uma tabela de materiais a partir de TEXTO extraído de PDF.

REGRAS CRÍTICAS:
1) TRANSCREVA os campos de texto EXATAMENTE como aparecem no texto (não corrija ortografia/acentos/maiúsculas).
2) Ignore cabeçalhos/rodapés e linhas vazias.
3) Normalize números com vírgula/ponto (R$ 12,90 → 12.9).
4) Se preço estiver vazio, use 0.
5) Retorne APENAS um array JSON (sem explicações).

Formato de cada item:
- description (string)
- unit (string, default "UN")
- supplier (string|null)
- material_price (number)
- labor_price (number)
- price (number)
- keywords (string[])
`;

        const callAiText = async ({ model, prompt }: { model: string; prompt: string }) => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 22_000);
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
                  { role: "system", content: systemPromptText },
                  { role: "user", content: prompt },
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

            const data = safeJson(raw);
            const extractedText = data?.choices?.[0]?.message?.content;
            if (!extractedText || typeof extractedText !== "string") {
              throw new Error("AI response missing content");
            }

            return { kind: "ok" as const, extractedText };
          } finally {
            clearTimeout(timeout);
          }
        };

        const modelsToTry = [
          "google/gemini-3-flash-preview",
          "google/gemini-2.5-flash",
          "google/gemini-2.5-pro",
        ];

        const extractOnePage = async (pageIndex1: number, pageText: string) => {
          const clipped = pageText.length > 45_000 ? pageText.slice(0, 45_000) : pageText;
          const prompt = `Página ${pageIndex1}/${nonEmpty.length} (texto extraído):\n${clipped}\n\nRetorne apenas o array JSON com os itens desta página.`;

          let lastErr: unknown = null;
          for (const model of modelsToTry) {
            for (let attempt = 1; attempt <= 2; attempt++) {
              try {
                console.log(`AI(text) call: page=${pageIndex1} model=${model} attempt=${attempt}`);
                const res = await callAiText({ model, prompt });
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

                const arr = parseJsonArrayFromModel(res.extractedText).map(normalizeItem);
                return arr.filter((it: any) => it.description);
              } catch (e) {
                lastErr = e;
                console.error(`AI(text) failed: page=${pageIndex1} model=${model} attempt=${attempt}`, e);
                if (attempt < 2) await sleep(250 * attempt);
              }
            }
          }
          throw (lastErr instanceof Error ? lastErr : new Error("Falha ao extrair itens da página"));
        };

        const concurrency = 2;
        const all: any[] = [];
        for (let i = 0; i < nonEmpty.length; i += concurrency) {
          const batch = nonEmpty.slice(i, i + concurrency);
          const batchRes = await Promise.all(batch.map((txt, idx) => extractOnePage(i + idx + 1, txt)));
          for (const r of batchRes) all.push(...r);
        }

        if (all.length > 0) {
          items = all;
        }
      }
    } catch (e) {
      console.warn("Fast path (pdf text) failed, falling back to multimodal:", e);
    }

    // 2) FALLBACK: multimodal com PDF em base64 (mais lento; usar só se texto falhar)
    if (!items) {
      if (!pdfBase64) {
        pdfBase64 = encodeBase64(pdfBytes.buffer);
      }

      if (pdfBase64.length > MAX_PDF_BASE64_LENGTH) {
        console.error(`PDF too large (base64): ${pdfBase64.length} (max: ${MAX_PDF_BASE64_LENGTH})`);
        return new Response(JSON.stringify({ error: "PDF file is too large. Maximum size is 5MB." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const systemPrompt = `Você é um extrator de dados de tabelas de materiais em PDF com ALTA PRECISÃO. Extraia TODOS os itens da tabela no formato JSON.

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
1. TRANSCREVA OS NOMES EXATAMENTE
2. Normalize números com vírgula/ponto
3. Retorne APENAS o array JSON, sem explicações`;

      const callAi = async (model: string) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 55_000);

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
                    { type: "text", text: "Extraia os dados desta planilha em formato JSON:" },
                    {
                      type: "image_url",
                      image_url: {
                        url: `data:application/pdf;base64,${pdfBase64}`,
                      },
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
            if (resp.status === 429) {
              return { kind: "rate_limit" as const, error: "Rate limit exceeded. Please try again later." };
            }
            if (resp.status === 402) {
              return { kind: "unavailable" as const, error: "AI service unavailable. Please try again later." };
            }
            throw new Error(`AI API error: ${resp.status} ${raw || ""}`.trim());
          }

          if (!raw.trim()) throw new Error("AI API returned an empty response body");

          const data = safeJson(raw);
          const extractedText = data?.choices?.[0]?.message?.content;
          if (!extractedText || typeof extractedText !== "string") {
            throw new Error("AI response missing content");
          }

          return { kind: "ok" as const, extractedText };
        } finally {
          clearTimeout(timeout);
        }
      };

      const modelsToTry = ["google/gemini-2.5-flash", "google/gemini-2.5-pro"];
      let extractedText: string | null = null;
      let lastErr: unknown = null;

      for (const model of modelsToTry) {
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            console.log(`AI(multimodal) call: model=${model} attempt=${attempt}`);
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
            console.error(`AI(multimodal) failed: model=${model} attempt=${attempt}`, err);
            if (attempt < 2) await sleep(300 * attempt);
          }
        }
        if (extractedText) break;
      }

      if (!extractedText) throw (lastErr instanceof Error ? lastErr : new Error("Failed to extract PDF data"));

      const arr = parseJsonArrayFromModel(extractedText).map(normalizeItem);
      items = arr.filter((it: any) => it.description);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error("No valid items extracted from PDF");
    }

    console.log(`Successfully extracted ${items.length} items for user: ${user.id}`);

    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in extract-pdf-data function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
