import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { spreadsheetData, customKeywords } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Processing spreadsheet with AI...');

    // Build enhanced system prompt with custom keywords
    let keywordsContext = '';
    if (customKeywords && Array.isArray(customKeywords) && customKeywords.length > 0) {
      const keywordsByType = customKeywords.reduce((acc: any, kw: any) => {
        if (!acc[kw.keyword_type]) acc[kw.keyword_type] = [];
        acc[kw.keyword_type].push(kw.keyword_value);
        return acc;
      }, {});
      
      keywordsContext = '\n\n=== CUSTOM KEYWORDS TO IDENTIFY (HIGHEST PRIORITY) ===\n';
      for (const [type, values] of Object.entries(keywordsByType)) {
        const typeLabel = type === 'brand' ? 'MARCAS' : 
                         type === 'color' ? 'CORES' : 
                         type === 'unit' ? 'UNIDADES' : 
                         type.toUpperCase();
        keywordsContext += `${typeLabel}: ${(values as string[]).join(', ')}\n`;
      }
      keywordsContext += `
CRITICAL INSTRUCTIONS FOR KEYWORDS:
1. These custom keywords have ABSOLUTE PRIORITY over any other identification
2. Match keywords in a case-insensitive manner: "Tigre", "tigre", "TIGRE" are all the same
3. Recognize SYNONYMS and similar variations:
   - "Tigre" matches "marca tigre", "da tigre", "tigre®"
   - "Branco" matches "cor branca", "na cor branco", "branco gelo"
   - "50kg" matches "50 kg", "50kg.", "50 quilos"
4. When you find ANY of these keywords or their variations, mark confidence as 95-100
5. If the data contains these keywords, they MUST be extracted and used
6. Look for keywords even if they appear mixed with other text in descriptions
`;
    }

    const systemPrompt = `You are an AI specialized in extracting construction material information from spreadsheet data.
Your task is to analyze each row and extract structured data intelligently.

EXTRACTION FIELDS:
- name: Material name (REQUIRED)
- brand: Brand name 
- color: Color 
- measurement: Size/dimensions (e.g., "50kg", "2.5L", "10x20cm")
- unit: Unit of measurement (m, m², m³, kg, L, un, etc)
- price: Unit price (numeric value only)
- quantity: Quantity (numeric value only)
- confidence: Your confidence level (0-100) in this extraction

${keywordsContext}

INTELLIGENCE RULES:
1. Parse complex descriptions intelligently. Example:
   "Cimento CP II-Z 50kg Marca Tigre Branco" should extract:
   - name: "Cimento CP II-Z"
   - brand: "Tigre"
   - color: "Branco"
   - measurement: "50kg"
   - unit: "kg"

2. Handle variations in data format:
   - Prices: "R$ 25,50", "25.50", "R$25,5" all = 25.50
   - Units: "M2", "m²", "metro quadrado" all = "m²"
   - Quantities: "10un", "10 unidades", "10" all = 10

3. Context awareness:
   - If you see "Tinta" and custom keyword "Suvinil", likely brand is "Suvinil"
   - If description has "18L" and custom unit "L", extract measurement "18L" and unit "L"

4. Confidence scoring:
   - 95-100: Keyword matched from custom list
   - 80-94: Clear identification without keywords
   - 60-79: Reasonable inference
   - Below 60: Uncertain extraction

Return a JSON array with ALL extracted materials. Never skip rows even if confidence is low.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extract material information from this data:\n${JSON.stringify(spreadsheetData)}` }
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_materials",
            description: "Extract material information from spreadsheet data",
            parameters: {
              type: "object",
              properties: {
                materials: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      brand: { type: "string" },
                      color: { type: "string" },
                      measurement: { type: "string" },
                      unit: { type: "string" },
                      price: { type: "number" },
                      quantity: { type: "number" },
                      confidence: { type: "number" }
                    },
                    required: ["name", "unit", "price", "quantity", "confidence"]
                  }
                }
              },
              required: ["materials"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "extract_materials" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições atingido. Tente novamente mais tarde.' }), 
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos ao seu workspace Lovable.' }), 
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI gateway error: ${errorText}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }

    const extractedMaterials = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({ materials: extractedMaterials.materials }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing spreadsheet:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
