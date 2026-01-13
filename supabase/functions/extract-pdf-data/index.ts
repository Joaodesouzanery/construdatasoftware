import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as pdfjsLib from "npm:pdfjs-dist@4.10.38/legacy/build/pdf.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_PDF_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BASE64_LENGTH = Math.ceil((MAX_PDF_BYTES / 3) * 4) + 16;

const MAX_PAGES_PER_AI_CALL = 3;
const MAX_TEXT_CHARS_PER_AI_CALL = 80_000;

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

const extractTextLinesFromPdf = async (pdfBytes: Uint8Array): Promise<{ numPages: number; pages: string[] }> => {
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
  const pdf = await loadingTask.promise;

  const pages: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // Agrupa por linha usando coordenada Y (tende a preservar linhas de tabela)
    const lines: string[] = [];
    let currentLine = "";
    let lastY: number | null = null;

    for (const item of (content.items as any[])) {
      const str = typeof item?.str === "string" ? item.str.trim() : "";
      if (!str) continue;

      const y = typeof item?.transform?.[5] === "number" ? item.transform[5] : 0;
      const yBucket = Math.round(y * 2) / 2; // bucket 0.5

      if (lastY !== null && Math.abs(yBucket - lastY) > 1) {
        if (currentLine.trim()) lines.push(currentLine.trim());
        currentLine = str;
      } else {
        currentLine = currentLine ? `${currentLine} ${str}` : str;
      }

      lastY = yBucket;
    }

    if (currentLine.trim()) lines.push(currentLine.trim());

    // Limpa linhas vazias e remove cabeçalhos comuns
    const cleaned = lines
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .filter((l) => {
        const n = normalizeTextKey(l);
        return !(
          n.includes("descricao") &&
          (n.includes("unidade") || n.includes("unit")) &&
          (n.includes("fornecedor") || n.includes("supplier"))
        );
      });

    pages.push(cleaned.join("\n"));
  }

  return { numPages: pdf.numPages, pages };
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

    const systemPromptText = `Você é um extrator de dados a partir de TEXTO de tabelas de materiais.
Retorne SEMPRE apenas um array JSON (sem explicações) com objetos contendo:
- description (texto)
- unit (texto, default \"UN\")
- supplier (texto|null)
- material_price (número)
- labor_price (número)
- price (número)
- keywords (array)

REGRAS:
1) Extraia TODOS os itens do trecho fornecido (não limite a 28).
2) Preserve a descrição o mais fiel possível ao texto.
3) Se só existir um preço, coloque em material_price e price; labor_price=0.
4) Se preço vazio, use 0.
5) Ignore cabeçalhos/rodapés e linhas sem material.`;

    const systemPromptMultimodal = `Você é um extrator de dados de tabelas de materiais em PDF com ALTA PRECISÃO.
Extraia TODOS os itens da tabela no formato JSON.

⚠️ ATENÇÃO MÁXIMA À ORTOGRAFIA:
- Copie os nomes dos materiais EXATAMENTE como aparecem no documento
- NÃO corrija, altere ou \"interprete\" os nomes - transcreva-os LITERALMENTE

Retorne um array JSON com objetos contendo:
- description (texto)
- unit (texto, default \"UN\")
- supplier (texto|null)
- material_price (número)
- labor_price (número)
- price (número)
- keywords (array)

REGRAS CRÍTICAS:
1) TRANSCREVA OS NOMES EXATAMENTE
2) Normalize números com vírgula/ponto (R$ 12,90 → 12.9)
3) Se preço vazio, use 0
4) Retorne APENAS o array JSON, sem explicações`;

    const callAiText = async (model: string, textChunk: string) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90_000);

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
              {
                role: "user",
                content: `Extraia os itens do trecho abaixo:\n\n${textChunk}`,
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

    const callAiPdf = async (model: string, pdfBase64: string) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90_000);

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
              { role: "system", content: systemPromptMultimodal },
              {
                role: "user",
                content: [
                  { type: "text", text: "Extraia os dados desta planilha em formato JSON:" },
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

    const modelsToTry = ["google/gemini-3-flash-preview", "google/gemini-2.5-flash", "google/gemini-2.5-pro"];

    // 1) Tenta extrair texto do PDF (lê o PDF inteiro / todas as páginas)
    let pages: string[] | null = null;
    let numPages = 0;

    try {
      const extracted = await extractTextLinesFromPdf(pdfBytes);
      pages = extracted.pages;
      numPages = extracted.numPages;
      console.log(`PDF text extracted: pages=${numPages}, chars=${pages.join("\n").length}`);
    } catch (e) {
      console.error("PDF text extraction failed, falling back to multimodal", e);
      pages = null;
      numPages = 0;
    }

    let allItems: ReturnType<typeof normalizeItem>[] = [];

    if (pages && pages.length > 0) {
      // 2) Chama IA por blocos de páginas (mais confiável para retornar tudo)
      const totalPages = pages.length;
      const batches: Array<{ start: number; end: number; text: string }> = [];

      for (let i = 0; i < totalPages; i += MAX_PAGES_PER_AI_CALL) {
        const start = i + 1;
        const end = Math.min(i + MAX_PAGES_PER_AI_CALL, totalPages);
        const slice = pages.slice(i, end);
        let text = slice.map((t, idx) => `### Página ${start + idx}\n${t}`).join("\n\n");

        // proteção contra payload grande
        if (text.length > MAX_TEXT_CHARS_PER_AI_CALL) {
          text = text.slice(0, MAX_TEXT_CHARS_PER_AI_CALL);
        }

        batches.push({ start, end, text });
      }

      for (const batch of batches) {
        let extractedText: string | null = null;
        let lastErr: unknown = null;

        for (const model of modelsToTry) {
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              console.log(`AI(text) call: pages=${batch.start}-${batch.end} model=${model} attempt=${attempt}`);
              const res = await callAiText(model, batch.text);
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
              console.error(`AI(text) call failed: pages=${batch.start}-${batch.end} model=${model} attempt=${attempt}`, err);
              if (attempt < 2) await sleep(500 * attempt);
            }
          }
          if (extractedText) break;
        }

        if (!extractedText) throw (lastErr instanceof Error ? lastErr : new Error("Failed to extract PDF data"));

        const batchItems = parseJsonArrayFromModel(extractedText)
          .map(normalizeItem)
          .filter((it) => it.description);

        console.log(`Batch extracted: pages=${batch.start}-${batch.end} items=${batchItems.length}`);
        allItems.push(...batchItems);
        await sleep(150); // pequena pausa para evitar throttling
      }

      allItems = dedupeItems(allItems);
      console.log(`Total extracted from text: items=${allItems.length}`);
    }

    // 3) Fallback: multimodal (caso texto falhe ou retorne vazio)
    if (allItems.length === 0) {
      console.log(`Extracting data from PDF using AI(multimodal) for user: ${user.id}...`);
      const pdfBase64 = encodeBase64(new Uint8Array(pdfBytes).buffer as ArrayBuffer);

      let extractedText: string | null = null;
      let lastErr: unknown = null;

      for (const model of modelsToTry) {
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            console.log(`AI(pdf) call: model=${model} attempt=${attempt}`);
            const res = await callAiPdf(model, pdfBase64);
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
            console.error(`AI(pdf) call failed: model=${model} attempt=${attempt}`, err);
            if (attempt < 2) await sleep(500 * attempt);
          }
        }
        if (extractedText) break;
      }

      if (!extractedText) throw (lastErr instanceof Error ? lastErr : new Error("Failed to extract PDF data"));

      const items = parseJsonArrayFromModel(extractedText).map(normalizeItem).filter((it) => it.description);
      allItems = dedupeItems(items);
      console.log(`Successfully extracted ${allItems.length} items (multimodal) for user: ${user.id}`);
    }

    if (allItems.length === 0) throw new Error("No valid items extracted from PDF");

    return new Response(JSON.stringify({ items: allItems, meta: { pages: numPages || undefined } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in extract-pdf-data function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
