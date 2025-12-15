import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Maximum PDF size in bytes (5MB base64 encoded = ~6.67MB string)
const MAX_PDF_SIZE = 7 * 1024 * 1024;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication failed:', authError?.message || 'No user found');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Authenticated user: ${user.id}`);

    const { pdfBase64 } = await req.json();

    // Input validation
    if (!pdfBase64 || typeof pdfBase64 !== 'string') {
      console.error('Invalid input: pdfBase64 is missing or not a string');
      return new Response(
        JSON.stringify({ error: 'Invalid input: pdfBase64 is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Size validation
    if (pdfBase64.length > MAX_PDF_SIZE) {
      console.error(`PDF too large: ${pdfBase64.length} bytes (max: ${MAX_PDF_SIZE})`);
      return new Response(
        JSON.stringify({ error: 'PDF file is too large. Maximum size is 5MB.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Basic base64 format validation
    const base64Regex = /^[A-Za-z0-9+/=]+$/;
    if (!base64Regex.test(pdfBase64)) {
      console.error('Invalid base64 format');
      return new Response(
        JSON.stringify({ error: 'Invalid PDF format: not valid base64 encoding' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log(`Extracting data from PDF using AI for user: ${user.id}...`);

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
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI service unavailable. Please try again later.' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const extractedText = data.choices[0].message.content;

    console.log('AI response received for user:', user.id);

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

    console.log(`Successfully extracted ${items.length} items for user: ${user.id}`);

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
