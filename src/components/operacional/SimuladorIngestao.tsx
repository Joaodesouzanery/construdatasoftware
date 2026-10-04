import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Send, Loader2 } from "lucide-react";

const EXEMPLO = JSON.stringify(
  {
    schema_version: 1,
    run_id: new Date().toISOString(),
    sent_at: new Date().toISOString(),
    file: { drive_file_id: "1AbC...", name: "CONTROLE_DE_CAIXA_ATUAL.xlsx", modified_at: new Date().toISOString() },
    sheet: {
      name: "DESPESAS",
      hash: "sha256:exemplo",
      first_row_number: 1,
      rows: [
        ["RECEITAS", null, "CONTAS A PAGAR"],
        ["ENTRADA", "DATA", "DESCRIÇÃO", "VALOR"],
        [5000, "2026-07-06", "CONSERTO DE 2 PNEUS DA RETRO", 400],
      ],
    },
  },
  null,
  2
);

// Ferramenta de teste (admin): cola o payload que o n8n enviaria + o token da
// fonte, chama op-ingest-sheet diretamente. O token digitado aqui NUNCA é
// guardado - só usado no fetch desta chamada.
export const SimuladorIngestao = () => {
  const [token, setToken] = useState("");
  const [payload, setPayload] = useState(EXEMPLO);
  const [resposta, setResposta] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    setErro(null);
    setResposta(null);

    if (!token.trim()) {
      setErro("Informe o token da fonte");
      return;
    }

    let corpo: unknown;
    try {
      corpo = JSON.parse(payload);
    } catch {
      setErro("JSON inválido");
      return;
    }

    setEnviando(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/op-ingest-sheet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ingest-token": token.replace(/[\s\u00A0\u200B-\u200D\uFEFF]/g, ""),
        },
        body: JSON.stringify(corpo),
      });
      const resultado = await response.json();
      setResposta(JSON.stringify(resultado, null, 2));
    } catch (error) {
      // TypeError "Failed to fetch" aqui significa que a chamada nem saiu da
      // rede (CORS, function não publicada) - distinto de um erro de negócio
      // vindo de dentro da função (esse chega via resultado.error, não aqui).
      if (error instanceof TypeError) {
        setErro("Não foi possível conectar à function op-ingest-sheet. Verifique se ela está publicada no projeto Supabase.");
      } else {
        setErro(error instanceof Error ? error.message : "Erro ao chamar a função");
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-4">
        <div>
          <Label>Token da fonte</Label>
          <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Cole o token gerado em Fontes" />
        </div>
        <div>
          <Label>Payload (JSON)</Label>
          <Textarea value={payload} onChange={(e) => setPayload(e.target.value)} rows={16} className="font-mono text-xs" />
        </div>
        <Button onClick={enviar} disabled={enviando}>
          {enviando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Enviar para op-ingest-sheet
        </Button>
      </Card>

      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {resposta && (
        <Card className="p-4">
          <Label className="mb-2 block">Resposta</Label>
          <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">{resposta}</pre>
        </Card>
      )}
    </div>
  );
};
