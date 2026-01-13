import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    let pdfBase64: string | null = null;

    // Aceita 3 formatos:
    // 1) application/octet-stream (recomendado): corpo = bytes do PDF
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
      const bytes = new Uint8Array(await file.arrayBuffer());
      pdfBase64 = encodeBase64(bytes.buffer);

      // Só tenta JSON quando o content-type realmente indica JSON.
      const body = await req.json().catch(() => ({} as any));
      if (body?.pdfBase64 && typeof body.pdfBase64 === "string") {
        pdfBase64 = body.pdfBase64;
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

      pdfBase64 = encodeBase64(bytes.buffer);
    }

    // Input validation
    if (!pdfBase64 || typeof pdfBase64 !== "string") {
      console.error("Invalid input: pdfBase64 is missing or not a string");
      return new Response(JSON.stringify({ error: "Invalid input: pdfBase64 is required and must be a string" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Size validation (base64)
    if (pdfBase64.length > MAX_PDF_BASE64_LENGTH) {
      console.error(`PDF too large (base64): ${pdfBase64.length} (max: ${MAX_PDF_BASE64_LENGTH})`);
      return new Response(JSON.stringify({ error: "PDF file is too large. Maximum size is 5MB." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Basic base64 format validation
    const base64Regex = /^[A-Za-z0-9+/=]+$/;
    if (!base64Regex.test(pdfBase64)) {
      console.error("Invalid base64 format");
      return new Response(JSON.stringify({ error: "Invalid PDF format: not valid base64 encoding" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    console.log(`Extracting data from PDF using AI for user: ${user.id}...`);

    const systemPrompt = `Você é um extrator de dados de tabelas de materiais em PDF com ALTA PRECISÃO. Extraia TODOS os itens da tabela no formato JSON.

⚠️ ATENÇÃO MÁXIMA À ORTOGRAFIA:
- Copie os nomes dos materiais EXATAMENTE como aparecem no documento
- NÃO corrija, altere ou "interprete" os nomes - transcreva-os LITERALMENTE
- Preste atenção especial a: letras duplas (rr, ss, ll), acentos (é, ã, ç), maiúsculas/minúsculas
- Se houver dúvida sobre uma letra, mantenha exatamente como está no PDF
- Exemplos de erros a EVITAR: "argamassa" virar "argamasa", "cerâmica" virar "ceramica", "hidráulico" virar "hidraulico"

A planilha pode ter as seguintes colunas:
- Descrição/Nome: descrição do item/material/serviço
- Unidade: unidade de medida (ex: UN, M, M², KG, etc.)
- Fornecedor: nome do fornecedor
- Preço Material: preço do material (número)
- Preço M.O.: preço da mão de obra (número)
- Preço Total: preço total (número)
- Palavras-Chave: palavras-chave separadas por vírgula

Retorne um array JSON com objetos contendo:
- description: descrição do item/material/serviço (texto) - COPIE EXATAMENTE COMO ESTÁ NO PDF
- unit: unidade de medida (texto). Se não houver, use "UN"
- supplier: nome do fornecedor (texto ou null) - COPIE EXATAMENTE COMO ESTÁ NO PDF
- material_price: preço do material (número). Se não houver, use 0
- labor_price: preço da mão de obra (número). Se não houver, use 0
- price: preço total (número). Se não houver, calcule material_price + labor_price
- keywords: array de palavras-chave (array de strings ou [])

Exemplo de saída esperada:
[
  {"description": "Cimento CP II-Z-32", "unit": "KG", "supplier": "Votorantim", "material_price": 25.5, "labor_price": 7.0, "price": 32.5, "keywords": ["cimento", "construção"]},
  {"description": "Areia média lavada", "unit": "M³", "supplier": null, "material_price": 150, "labor_price": 30, "price": 180, "keywords": ["areia"]}
]

REGRAS CRÍTICAS:
1. TRANSCREVA OS NOMES EXATAMENTE - sem correções ortográficas, sem alterações
2. Extraia TODOS os itens (ignore títulos/cabeçalhos e linhas vazias)
3. Normalize números com vírgula/ponto (R$ 12,90 → 12.9)
4. Se o preço estiver como "R$ -" ou vazio, use 0
5. Retorne APENAS o array JSON, sem explicações`;

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
            temperature: 0.1,
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

        if (!raw.trim()) {
          throw new Error("AI API returned an empty response body");
        }

        let data: any;
        try {
          data = JSON.parse(raw);
        } catch (e) {
          console.error("AI API returned invalid JSON:", String(e));
          throw new Error("AI API returned invalid JSON");
        }

        const extractedText = data?.choices?.[0]?.message?.content;
        if (!extractedText || typeof extractedText !== "string") {
          console.error("AI response missing content:", JSON.stringify(data)?.slice(0, 500));
          throw new Error("AI response missing content");
        }

        return { kind: "ok" as const, extractedText };
      } finally {
        clearTimeout(timeout);
      }
    };

    // Tentativa rápida primeiro (melhora velocidade), com fallback para Pro.
    const modelsToTry = ["google/gemini-2.5-flash", "google/gemini-2.5-pro"];

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
          if (attempt < 2) await sleep(300 * attempt);
        }
      }

      if (extractedText) break;
    }

    if (!extractedText) {
      throw (lastErr instanceof Error ? lastErr : new Error("Failed to extract PDF data"));
    }

    console.log("AI response received for user:", user.id);

    // Parse the JSON response (conteúdo retornado pelo modelo)
    let items: unknown;
    try {
      // Remove markdown code blocks if present
      const jsonText = extractedText.replace(/```json\n?|\n?```/g, "").trim();
      items = JSON.parse(jsonText);
    } catch (parseError) {
      console.error("Error parsing AI extracted content:", parseError);
      throw new Error("Failed to parse extracted data");
    }

    if (!Array.isArray(items) || items.length === 0) {
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
