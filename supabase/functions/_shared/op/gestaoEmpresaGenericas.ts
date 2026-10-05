// =============================================
// MÓDULO OPERACIONAL: mapa de configuração das abas genéricas (Fase G2)
// =============================================
// As 27 abas do perfil gestao_empresa sem interpretador dedicado (as 5
// restantes - 01C, 08C*, 01B, 11, 13 - continuam com os interpretadores
// próprios em gestaoEmpresa.ts). Cada entrada aqui é dado de configuração,
// não código: aba -> tipo estrutural (lista ou série mensal) -> chave.
// Tabela de config estática, sem lógica - a lógica de interpretação é a
// mesma para todas (interpretadoresGenericos.ts).

import { normalizarRotulo } from "./parsing.ts";

export type ConfigAbaGenerica =
  | { sheetName: string; tipo: "lista"; sheetKey: string; colunasChave: string[] }
  | { sheetName: string; tipo: "serie_mensal"; sheetKey: string; colunasRotulo?: string[] };

export const GESTAO_EMPRESA_GENERICAS: ConfigAbaGenerica[] = [
  // --- LISTA ---
  { sheetName: "03. CONTRATOS", tipo: "lista", sheetKey: "gestao_empresa.contratos", colunasChave: ["CONTRATO"] },
  { sheetName: "03A. OBRAS E CONTAS", tipo: "lista", sheetKey: "gestao_empresa.obras_e_contas", colunasChave: ["CÓDIGO"] },
  { sheetName: "04. ITENS DE CONTRATO", tipo: "lista", sheetKey: "gestao_empresa.itens_de_contrato", colunasChave: ["CONTRATO"] },
  { sheetName: "04A. ADITIVO", tipo: "lista", sheetKey: "gestao_empresa.aditivo", colunasChave: ["OBRA"] },
  { sheetName: "05. QUANTITATIVOS DE CAMPO", tipo: "lista", sheetKey: "gestao_empresa.quantitativos_de_campo", colunasChave: ["Nº"] },
  { sheetName: "06. MEDIÇÃO (BM)", tipo: "lista", sheetKey: "gestao_empresa.medicao_bm", colunasChave: ["CONTRATO", "Nº DO BM"] },
  { sheetName: "07. FATURAMENTO E RECEBIMENTO", tipo: "lista", sheetKey: "gestao_empresa.faturamento_e_recebimento", colunasChave: ["Nº"] },
  { sheetName: "12. EVM E CURVA S", tipo: "lista", sheetKey: "gestao_empresa.evm_e_curva_s", colunasChave: ["CONTRATO"] },
  { sheetName: "14. FONTES", tipo: "lista", sheetKey: "gestao_empresa.fontes", colunasChave: ["FONTE"] },
  // "ABA / ITEM" tem espaço dos dois lados da barra no cabeçalho real -
  // confirmado pelo snapshot real (sem o espaço, a chave nunca batia e a
  // aba inteira ficava com 0 registros).
  { sheetName: "15. CHANGELOG", tipo: "lista", sheetKey: "gestao_empresa.changelog", colunasChave: ["DATA", "ABA / ITEM", "O QUE MUDOU"] },
  { sheetName: "X2. PLANO DE CONTAS", tipo: "lista", sheetKey: "gestao_empresa.plano_de_contas", colunasChave: ["CONTA"] },
  { sheetName: "X3. MOTOR CENARIOS", tipo: "lista", sheetKey: "gestao_empresa.motor_cenarios", colunasChave: ["Nº"] },
  { sheetName: "01A. CENÁRIOS", tipo: "lista", sheetKey: "gestao_empresa.cenarios", colunasChave: ["CENÁRIO"] },
  { sheetName: "08B. TODAS AS OBRAS", tipo: "lista", sheetKey: "gestao_empresa.todas_as_obras", colunasChave: ["OBRA"] },

  // --- SÉRIE MENSAL ---
  { sheetName: "02. PARÂMETROS", tipo: "serie_mensal", sheetKey: "gestao_empresa.parametros", colunasRotulo: ["ID", "CONTRATO", "BLOCO", "CONTA", "LINHA"] },
  { sheetName: "10. BASE", tipo: "serie_mensal", sheetKey: "gestao_empresa.base" },
  { sheetName: "C1. ZN", tipo: "serie_mensal", sheetKey: "gestao_empresa.c1_zn" },
  { sheetName: "C2. BERTIOGA E SANTOS", tipo: "serie_mensal", sheetKey: "gestao_empresa.c2_bertioga_e_santos" },
  { sheetName: "C3. VITA CUBATAO", tipo: "serie_mensal", sheetKey: "gestao_empresa.c3_vita_cubatao" },
  { sheetName: "C4. OPORTUNIDADES", tipo: "serie_mensal", sheetKey: "gestao_empresa.c4_oportunidades" },
  { sheetName: "C5. ESTRUTURA", tipo: "serie_mensal", sheetKey: "gestao_empresa.c5_estrutura" },
  { sheetName: "08. CUSTOS", tipo: "serie_mensal", sheetKey: "gestao_empresa.custos" },
  { sheetName: "09. DRE", tipo: "serie_mensal", sheetKey: "gestao_empresa.dre" },
  { sheetName: "10. CAIXA", tipo: "serie_mensal", sheetKey: "gestao_empresa.caixa" },
  { sheetName: "C6. TRIBUTOS", tipo: "serie_mensal", sheetKey: "gestao_empresa.c6_tributos" },
  { sheetName: "X1. FLUXO", tipo: "serie_mensal", sheetKey: "gestao_empresa.x1_fluxo" },

  // NOTA: "11. CONCILIAÇÃO E WIP" não entra aqui - o bloco A já tem
  // interpretador dedicado (interpretarPonteLucroCaixa, em gestaoEmpresa.ts)
  // e getInterpreter despacha só UM interpretador por aba, então um nome
  // igual aqui nunca seria alcançado. Os demais blocos dessa aba (fora o A)
  // ainda não têm cobertura - precisaria compor 2 interpretadores para a
  // mesma aba, o que o despacho atual não suporta.
];

// Comparação sempre normalizada (sem acento, maiúsculo) - mesma função usada
// por getInterpreter para decidir entre os 5 interpretadores dedicados,
// então uma aba só cai aqui se nenhum deles já a atendeu.
export function buscarConfigAbaGenerica(sheetName: string): ConfigAbaGenerica | null {
  const nomeNormalizado = normalizarRotulo(sheetName);
  return GESTAO_EMPRESA_GENERICAS.find((c) => normalizarRotulo(c.sheetName) === nomeNormalizado) ?? null;
}
