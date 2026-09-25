import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useGeolocation } from "@/hooks/useGeolocation";
import { LogIn, LogOut, Coffee, Play, AlertCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type TipoPonto = "entrada" | "inicio_intervalo" | "fim_intervalo" | "saida";

const PROXIMOS_TIPOS: Record<string, TipoPonto[]> = {
  none: ["entrada"],
  entrada: ["inicio_intervalo", "saida"],
  inicio_intervalo: ["fim_intervalo"],
  fim_intervalo: ["inicio_intervalo", "saida"],
  saida: ["entrada"],
};

const LABELS: Record<TipoPonto, { texto: string; icone: typeof LogIn }> = {
  entrada: { texto: "Bater Entrada", icone: LogIn },
  inicio_intervalo: { texto: "Iniciar Intervalo", icone: Coffee },
  fim_intervalo: { texto: "Finalizar Intervalo", icone: Play },
  saida: { texto: "Bater Saída", icone: LogOut },
};

interface PontoWidgetProps {
  funcionarioId: string;
}

// Widget de bater ponto: captura geolocalização via useGeolocation e chama a
// edge function registrar-ponto. A decisão final (sequência + geofence)
// acontece no banco (trigger validar_registro_ponto) - erros do servidor são
// mostrados aqui verbatim, em Alert inline (não só toast, para não passar
// despercebido no campo).
export const PontoWidget = ({ funcionarioId }: PontoWidgetProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { location, error: geoError, isLoading: geoLoading, getCurrentLocation } = useGeolocation();
  const [tipoPendente, setTipoPendente] = useState<TipoPonto | null>(null);
  const [erroPonto, setErroPonto] = useState<string | null>(null);

  const { data: ultimoRegistro, isLoading } = useQuery({
    queryKey: ["ponto-meu-status", funcionarioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registros_ponto")
        .select("tipo, momento")
        .eq("funcionario_id", funcionarioId)
        .order("momento", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as { tipo: TipoPonto; momento: string } | null;
    },
    enabled: Boolean(funcionarioId),
  });

  const mutation = useMutation({
    mutationFn: async ({
      tipo,
      latitude,
      longitude,
      precisao,
    }: {
      tipo: TipoPonto;
      latitude: number;
      longitude: number;
      precisao?: number;
    }) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) throw new Error("Sessão não encontrada");

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/registrar-ponto`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          funcionario_id: funcionarioId,
          tipo,
          latitude,
          longitude,
          precisao_metros: precisao,
          device_timestamp: new Date().toISOString(),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Erro ao registrar ponto");
      }
      return result;
    },
    onSuccess: () => {
      toast({ title: "Ponto registrado!" });
      setErroPonto(null);
      queryClient.invalidateQueries({ queryKey: ["ponto-meu-status", funcionarioId] });
      queryClient.invalidateQueries({ queryKey: ["ponto-meu-historico"] });
    },
    onError: (error: Error) => {
      setErroPonto(error.message);
    },
  });

  useEffect(() => {
    if (tipoPendente && location) {
      mutation.mutate({
        tipo: tipoPendente,
        latitude: location.latitude,
        longitude: location.longitude,
        precisao: location.accuracy,
      });
      setTipoPendente(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  useEffect(() => {
    if (tipoPendente && geoError) {
      setErroPonto(geoError);
      setTipoPendente(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoError]);

  const handleBaterPonto = (tipo: TipoPonto) => {
    setErroPonto(null);
    setTipoPendente(tipo);
    getCurrentLocation();
  };

  const ultimoTipo = ultimoRegistro?.tipo ?? "none";
  const proximosTipos = PROXIMOS_TIPOS[ultimoTipo] ?? ["entrada"];
  const aguardando = geoLoading || mutation.isPending || Boolean(tipoPendente);

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-6">
        <div className="text-center space-y-1 mb-4">
          <p className="text-sm text-muted-foreground capitalize">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
          {ultimoRegistro && (
            <p className="text-xs text-muted-foreground">
              Última batida: {LABELS[ultimoRegistro.tipo].texto} às {format(new Date(ultimoRegistro.momento), "HH:mm")}
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-3">
            {proximosTipos.map((tipo) => {
              const { texto, icone: Icone } = LABELS[tipo];
              const carregandoEsteTipo = aguardando && tipoPendente === tipo;
              return (
                <Button key={tipo} size="lg" className="h-14 text-base" disabled={aguardando} onClick={() => handleBaterPonto(tipo)}>
                  {carregandoEsteTipo ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Icone className="h-5 w-5 mr-2" />}
                  {texto}
                </Button>
              );
            })}
          </div>
        )}
      </Card>

      {erroPonto && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Não foi possível registrar o ponto</AlertTitle>
          <AlertDescription>{erroPonto}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};
