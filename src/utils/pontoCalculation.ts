// Reconciliação de ponto real (registros_ponto) para exibição no frontend -
// agrupa registros em dias e reaproveita os cálculos de src/utils/cltValidation.ts
// (mesmo motor de alertas com citação de artigo da CLT) em vez de duplicá-los.
// O cálculo autoritativo do banco de horas mensal é feito no servidor pela
// edge function calcular-banco-horas (supabase/functions/_shared/pontoCalculation.ts) -
// este arquivo é só para montar a tabela de histórico e os exports.

import {
  calcularHorasTrabalhadas,
  calcularHorasNoturnas,
  validarEscalaCLT,
  CONFIG_CLT_PADRAO,
  type ConfiguracaoCLT,
  type AlertaCLT,
} from "./cltValidation";

export interface RegistroPontoResumo {
  id: string;
  tipo: "entrada" | "inicio_intervalo" | "fim_intervalo" | "saida";
  momento: string;
}

export interface DiaPonto {
  data: string;
  registros: RegistroPontoResumo[];
  horaEntrada?: string;
  horaSaida?: string;
  horaInicioIntervalo?: string;
  horaFimIntervalo?: string;
  horasTrabalhadas: number;
  horasNoturnas: number;
  alertas: AlertaCLT[];
  sessaoAberta: boolean;
}

const horaDoMomento = (momento: string) => {
  const d = new Date(momento);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// Agrupa registros (já ordenados por momento) em dias, usando a data da
// batida de "entrada" como chave - cobre turnos que cruzam a meia-noite.
export function agruparRegistrosPorDia(
  registrosOrdenados: RegistroPontoResumo[],
  config: ConfiguracaoCLT = CONFIG_CLT_PADRAO
): DiaPonto[] {
  const dias: DiaPonto[] = [];
  let atual: DiaPonto | null = null;

  for (const registro of registrosOrdenados) {
    if (registro.tipo === "entrada") {
      atual = {
        data: registro.momento.split("T")[0],
        registros: [registro],
        horaEntrada: horaDoMomento(registro.momento),
        horasTrabalhadas: 0,
        horasNoturnas: 0,
        alertas: [],
        sessaoAberta: true,
      };
      dias.push(atual);
    } else if (atual) {
      atual.registros.push(registro);
      if (registro.tipo === "inicio_intervalo") atual.horaInicioIntervalo = horaDoMomento(registro.momento);
      if (registro.tipo === "fim_intervalo") atual.horaFimIntervalo = horaDoMomento(registro.momento);
      if (registro.tipo === "saida") {
        atual.horaSaida = horaDoMomento(registro.momento);
        atual.sessaoAberta = false;
      }
    }
  }

  for (const dia of dias) {
    if (dia.horaEntrada && dia.horaSaida) {
      dia.horasTrabalhadas = calcularHorasTrabalhadas(
        dia.horaEntrada,
        dia.horaSaida,
        dia.horaInicioIntervalo,
        dia.horaFimIntervalo
      );
      dia.horasNoturnas = calcularHorasNoturnas(dia.horaEntrada, dia.horaSaida, config);
      dia.alertas = validarEscalaCLT(
        dia.horasTrabalhadas,
        dia.horasNoturnas,
        Boolean(dia.horaInicioIntervalo && dia.horaFimIntervalo),
        0,
        0,
        config
      );
    }
  }

  return dias;
}

export function formatarHoras(horas: number): string {
  const sinal = horas < 0 ? "-" : "";
  const abs = Math.abs(horas);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  return `${sinal}${h}h${String(m).padStart(2, "0")}`;
}
