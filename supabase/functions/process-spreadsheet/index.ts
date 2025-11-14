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
      
      keywordsContext = '\n\nCustom keywords to prioritize when identifying materials:\n';
      for (const [type, values] of Object.entries(keywordsByType)) {
        keywordsContext += `- ${type}: ${(values as string[]).join(', ')}\n`;
      }
      keywordsContext += '\nWhen you see these keywords or similar/synonym words, use them. Be case-insensitive.\n';
    }

    const systemPrompt = `You are an expert at extracting material information from spreadsheet data.
Extract the following information from each row:
- name: Material name
- brand: Brand name (if mentioned)
- color: Color (if mentioned)
- measurement: Size/dimensions (if mentioned)
- unit: Unit of measurement (m, m², m³, kg, un, etc)
- price: Unit price (numeric value only)
- quantity: Quantity (numeric value only)
- confidence: Confidence level (0-100) for the extraction
${keywordsContext}
Be intelligent about identifying these fields even if they're mixed in descriptions.
Look for synonyms and similar words to the custom keywords provided.
For example: "Tigre", "tigre", "TIGRE" should all match if "Tigre" is a custom keyword.

Return a JSON array with extracted materials, each with a confidence score.`;

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
