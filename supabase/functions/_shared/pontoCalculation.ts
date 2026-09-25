// Reconciliação de ponto real (registros_ponto) contra a escala planejada
// (escalas_clt) para a edge function calcular-banco-horas. Runtime Deno -
// duplicado deliberadamente de src/utils/cltValidation.ts / pontoCalculation.ts
// (runtimes diferentes), mas mantendo a mesma convenção CLT (jornada padrão,
// percentuais de hora extra, janela noturna 22h-05h).

export interface ConfiguracaoCLT {
  jornada_diaria_padrao: number;
  percentual_hora_extra_50: number;
  percentual_hora_extra_100: number;
  hora_inicio_noturno: string;
  hora_fim_noturno: string;
}

export const CONFIG_CLT_PADRAO: ConfiguracaoCLT = {
  jornada_diaria_padrao: 8,
  percentual_hora_extra_50: 50,
  percentual_hora_extra_100: 100,
  hora_inicio_noturno: "22:00",
  hora_fim_noturno: "05:00",
};

export interface RegistroPonto {
  tipo: "entrada" | "inicio_intervalo" | "fim_intervalo" | "saida";
  momento: string; // ISO timestamptz
}

export interface Sessao {
  dataEntrada: string; // YYYY-MM-DD, chave do dia (data da batida de entrada)
  registros: RegistroPonto[];
  aberta: boolean; // sessão sem "saida" (turno em andamento ou ponto esquecido)
}

// Agrupa registros ordenados cronologicamente em sessões entrada->saida.
// Cobre turnos que cruzam a meia-noite: a sessão é rotulada pela data da
// própria "entrada", não pela data corrente.
export function agruparEmSessoes(registrosOrdenados: RegistroPonto[]): Sessao[] {
  const sessoes: Sessao[] = [];
  let atual: Sessao | null = null;

  for (const registro of registrosOrdenados) {
    if (registro.tipo === "entrada") {
      atual = {
        dataEntrada: registro.momento.split("T")[0],
        registros: [registro],
        aberta: true,
      };
      sessoes.push(atual);
    } else if (atual) {
      atual.registros.push(registro);
      if (registro.tipo === "saida") {
        atual.aberta = false;
        atual = null;
      }
    }
    // registros de intervalo sem uma "entrada" antes (dado inconsistente) são ignorados
  }

  return sessoes;
}

function nightOverlapMinutes(start: Date, end: Date, config: ConfiguracaoCLT): number {
  const [inicioNotH] = config.hora_inicio_noturno.split(":").map(Number);
  const [fimNotH] = config.hora_fim_noturno.split(":").map(Number);
  let totalMinutos = 0;
  let cursor = new Date(start);

  while (cursor < end) {
    const hour = cursor.getHours();
    const isNight = hour >= inicioNotH || hour < fimNotH;
    const next = new Date(cursor.getTime() + 60000);
    const segmentEnd = next < end ? next : end;
    if (isNight) {
      totalMinutos += (segmentEnd.getTime() - cursor.getTime()) / 60000;
    }
    cursor = segmentEnd;
  }

  return totalMinutos;
}

export interface ResultadoSessao {
  horasTrabalhadas: number;
  horasNoturnas: number;
  completa: boolean;
}

// Calcula horas trabalhadas (excluindo intervalos) e horas noturnas de uma sessão.
export function calcularHorasSessao(sessao: Sessao, config: ConfiguracaoCLT = CONFIG_CLT_PADRAO): ResultadoSessao {
  let minutosTrabalhados = 0;
  let minutosNoturnos = 0;
  let emIntervalo = false;
  let ultimoMomento: Date | null = null;

  for (const registro of sessao.registros) {
    const momento = new Date(registro.momento);

    if (ultimoMomento && !emIntervalo) {
      minutosTrabalhados += (momento.getTime() - ultimoMomento.getTime()) / 60000;
      minutosNoturnos += nightOverlapMinutes(ultimoMomento, momento, config);
    }

    if (registro.tipo === "inicio_intervalo") emIntervalo = true;
    if (registro.tipo === "fim_intervalo") emIntervalo = false;

    ultimoMomento = momento;
  }

  return {
    horasTrabalhadas: minutosTrabalhados / 60,
    horasNoturnas: minutosNoturnos / 60,
    completa: !sessao.aberta,
  };
}

export interface ResultadoDia {
  data: string;
  horasTrabalhadas: number;
  horasNoturnas: number;
  horasNormaisPlanejadas: number;
  horasExtras: number;
  percentualExtra: number;
  divergenciaEscala: boolean; // houve ponto batido sem escala planejada para o dia
  sessaoIncompleta: boolean;
}

export function reconciliarDia(
  sessoes: Sessao[],
  horasNormaisPlanejadas: number | null,
  isDomingoOuFeriado: boolean,
  config: ConfiguracaoCLT = CONFIG_CLT_PADRAO
): ResultadoDia | null {
  if (sessoes.length === 0) return null;

  const data = sessoes[0].dataEntrada;
  let horasTrabalhadas = 0;
  let horasNoturnas = 0;
  let sessaoIncompleta = false;

  for (const sessao of sessoes) {
    const resultado = calcularHorasSessao(sessao, config);
    horasTrabalhadas += resultado.horasTrabalhadas;
    horasNoturnas += resultado.horasNoturnas;
    if (!resultado.completa) sessaoIncompleta = true;
  }

  const normalBase = horasNormaisPlanejadas ?? config.jornada_diaria_padrao;
  const divergenciaEscala = horasNormaisPlanejadas === null;

  let horasNormais = Math.min(horasTrabalhadas, normalBase);
  let horasExtras = Math.max(0, horasTrabalhadas - normalBase);
  let percentualExtra = config.percentual_hora_extra_50;

  if (isDomingoOuFeriado) {
    percentualExtra = config.percentual_hora_extra_100;
    horasExtras = horasTrabalhadas;
    horasNormais = 0;
  }

  return {
    data,
    horasTrabalhadas,
    horasNoturnas,
    horasNormaisPlanejadas: horasNormais,
    horasExtras,
    percentualExtra,
    divergenciaEscala,
    sessaoIncompleta,
  };
}
