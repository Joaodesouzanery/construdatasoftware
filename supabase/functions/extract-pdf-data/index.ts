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
    const { pdfBase64 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Extracting data from PDF using AI...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é um extrator de dados de planilhas. Extraia TODOS os itens da planilha/tabela no formato JSON.
            
Retorne um array JSON com objetos contendo:
- description: descrição do item/material/serviço
- quantity: quantidade (número)
- unit: unidade de medida (texto)

Exemplo de saída esperada:
[
  {"description": "Cimento", "quantity": 100, "unit": "kg"},
  {"description": "Areia", "quantity": 50, "unit": "m³"}
]

IMPORTANTE:
- Extraia TODOS os itens que encontrar
- Se não houver quantidade, use 1
- Se não houver unidade, use "UN"
- Retorne APENAS o array JSON, sem explicações`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extraia os dados desta planilha em formato JSON:'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`
                }
              }
            ]
          }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const extractedText = data.choices[0].message.content;

    console.log('AI response:', extractedText);

    // Parse the JSON response
    let items;
    try {
      // Remove markdown code blocks if present
      const jsonText = extractedText.replace(/```json\n?|\n?```/g, '').trim();
      items = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      throw new Error('Failed to parse extracted data');
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('No valid items extracted from PDF');
    }

    console.log(`Successfully extracted ${items.length} items`);

    return new Response(
      JSON.stringify({ items }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-pdf-data function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
