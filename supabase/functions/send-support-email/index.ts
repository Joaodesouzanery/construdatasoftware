import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SupportEmailRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, subject, message }: SupportEmailRequest = await req.json();

    // Enviar email para o suporte
    const emailResponse = await resend.emails.send({
      from: "Suporte Construdata <onboarding@resend.dev>",
      to: ["construdata.contato@gmail.com"],
      replyTo: email,
      subject: `[Suporte] ${subject}`,
      html: `
        <h2>Nova mensagem de suporte</h2>
        <p><strong>De:</strong> ${name} (${email})</p>
        <p><strong>Assunto:</strong> ${subject}</p>
        <hr>
        <p><strong>Mensagem:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `,
    });

    // Enviar confirmação para o usuário
    await resend.emails.send({
      from: "Construdata <onboarding@resend.dev>",
      to: [email],
      subject: "Recebemos sua mensagem!",
      html: `
        <h1>Obrigado por entrar em contato, ${name}!</h1>
        <p>Recebemos sua mensagem e nossa equipe responderá em breve.</p>
        <p><strong>Assunto:</strong> ${subject}</p>
        <hr>
        <p><strong>Sua mensagem:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
        <br>
        <p>Atenciosamente,<br>Equipe Construdata</p>
      `,
    });

    console.log("Support email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-support-email function:", error);
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
