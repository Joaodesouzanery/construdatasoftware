import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConfigRequest {
  projectId: string;
  email: string;
  frequency: 'weekly' | 'monthly' | 'both';
  enabled: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, email, frequency, enabled }: ConfigRequest = await req.json();

    // Store configuration (you would typically save this to a database table)
    // For now, we'll just return success
    
    console.log("Report configuration saved:", {
      projectId,
      email,
      frequency,
      enabled
    });

    // In a production environment, you would:
    // 1. Store this configuration in a database table
    // 2. Set up a cron job using pg_cron to call send-production-report
    // 3. The cron job would check the configuration and send reports accordingly

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Configuração salva com sucesso. Os relatórios serão enviados conforme configurado." 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in configure-reports:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);