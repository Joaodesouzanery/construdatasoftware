import { CRIADOUROS, MOTIVOS_PARALISACAO } from "@/lib/rdoSabespCatalog";
import logoSabesp from "@/assets/logo-sabesp.png";
import logoCslnr from "@/assets/logo-cslnr.jpg";

/**
 * Réplica visual da planilha RDO Sabesp.
 * - readOnly=false: campos editáveis (formulário)
 * - readOnly=true:  apenas leitura (preview/revisão)
 * - missing: lista de paths obrigatórios faltando, p/ destacar em vermelho
 */

interface SheetProps {
  data: any;
  set?: (path: string, val: any) => void;
  readOnly?: boolean;
  missing?: Set<string>;
}

const cell = "border border-black px-1 py-[2px] text-[11px] align-middle break-words whitespace-normal";
const head = "border border-black px-1 py-[2px] text-[11px] font-bold text-center bg-gray-200 break-words whitespace-normal";
const subhead = "border border-black px-1 py-[2px] text-[10px] font-bold text-center bg-gray-100 break-words whitespace-normal";
const orange = "border border-black px-1 py-[2px] text-[12px] font-bold text-center bg-orange-400";
const blue = "border border-black px-1 py-[2px] text-[12px] font-bold text-center bg-sky-300";

function Field({
  value,
  onChange,
  readOnly,
  missing,
  type = "text",
  className = "",
  placeholder,
}: {
  value: any;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  missing?: boolean;
  type?: string;
  className?: string;
  placeholder?: string;
}) {
  if (readOnly) {
    return (
      <span className={`${className} ${missing ? "bg-red-200 text-red-700 font-semibold px-1" : ""}`}>
        {value || (missing ? "(faltando)" : "")}
      </span>
    );
  }
  return (
    <input
      type={type}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      className={`bg-transparent outline-none w-full ${missing ? "bg-red-100 ring-1 ring-red-500" : ""} ${className}`}
    />
  );
}

function Check({
  checked,
  onToggle,
  readOnly,
  label,
  missing,
}: { checked: boolean; onToggle?: () => void; readOnly?: boolean; label?: string; missing?: boolean }) {
  return (
    <label className={`inline-flex items-center gap-1 cursor-pointer ${missing ? "ring-1 ring-red-500 px-0.5" : ""}`}>
      <span
        onClick={() => !readOnly && onToggle?.()}
        className={`inline-block w-3 h-3 border border-black ${checked ? "bg-black" : "bg-white"}`}
      />
      {label && <span className="text-[11px]">{label}</span>}
    </label>
  );
}

export function RdoSabespSheet({ data, set, readOnly = false, missing = new Set<string>() }: SheetProps) {
  const m = (k: string) => missing.has(k);
  const cc = data.condicoes_climaticas || {};
  const q = data.qualidade || {};
  const h = data.horarios || {};
  const para = data.paralisacoes || [];
  const mo = data.mao_de_obra || [];
  const eq = data.equipamentos || [];

  const setCC = (p: string, period: "manha" | "tarde" | "noite") => {
    if (!set) return;
    set(`condicoes_climaticas.${period}`, cc[period] === p ? "" : p);
  };

  // Mão de obra em 2 colunas (par/ímpar)
  const moLeft = mo.filter((_: any, i: number) => i % 2 === 0);
  const moRight = mo.filter((_: any, i: number) => i % 2 === 1);
  const eqLeft = eq.filter((_: any, i: number) => i % 2 === 0);
  const eqRight = eq.filter((_: any, i: number) => i % 2 === 1);
  const maxRows = Math.max(moLeft.length, moRight.length, 7);
  const maxEq = Math.max(eqLeft.length, eqRight.length, 6);

  const updateMo = (originalIdx: number, field: string, val: any) => {
    if (!set) return;
    const arr = [...mo];
    arr[originalIdx] = { ...arr[originalIdx], [field]: val };
    set("mao_de_obra", arr);
  };
  const updateEq = (originalIdx: number, field: string, val: any) => {
    if (!set) return;
    const arr = [...eq];
    arr[originalIdx] = { ...arr[originalIdx], [field]: val };
    set("equipamentos", arr);
  };

  const esgoto = data.servicos_esgoto || [];
  const agua = data.servicos_agua || [];
  const maxServ = Math.max(esgoto.length, agua.length);

  const updateServ = (key: "servicos_esgoto" | "servicos_agua", i: number, field: string, val: any) => {
    if (!set) return;
    const arr = [...data[key]];
    arr[i] = { ...arr[i], [field]: field === "quantidade" ? Number(val) || 0 : val };
    set(key, arr);
  };

  return (
    <div className="bg-white text-black border border-black overflow-x-auto">
      <table className="w-full border-collapse" style={{ minWidth: 900 }}>
        <tbody>
          {/* === HEADER === */}
          <tr>
            <td className={cell} colSpan={2} style={{ width: 130 }}>
              <img src={logoSabesp} alt="Sabesp" className="h-10 mx-auto object-contain" />
            </td>
            <td className={`${cell} text-center font-bold text-[14px]`} colSpan={6}>
              RELATÓRIO DIÁRIO DE OBRA (RDO)
            </td>
            <td className={cell} colSpan={4}>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                {CRIADOUROS.filter((c) => c.value !== "outro").map((c) => (
                  <Check
                    key={c.value}
                    checked={data.criadouro === c.value}
                    onToggle={() => set?.("criadouro", data.criadouro === c.value ? "" : c.value)}
                    readOnly={readOnly}
                    label={c.label}
                    missing={m("criadouro")}
                  />
                ))}
              </div>
            </td>
            <td className={cell} colSpan={2} style={{ width: 80 }}>
              <img src={logoCslnr} alt="CSLNR" className="h-10 mx-auto object-contain" />
            </td>
          </tr>

          {/* RUA / ENCARREGADO / DATA */}
          <tr>
            <td className={`${cell} font-bold`}>RUA/BECO:</td>
            <td className={cell} colSpan={5}>
              <Field value={data.rua_beco} onChange={(v) => set?.("rua_beco", v)} readOnly={readOnly} missing={m("rua_beco")} />
            </td>
            <td className={`${cell} font-bold`}>ENCARREGADO:</td>
            <td className={cell} colSpan={4}>
              <Field value={data.encarregado} onChange={(v) => set?.("encarregado", v)} readOnly={readOnly} missing={m("encarregado")} />
            </td>
            <td className={`${cell} font-bold`}>DATA:</td>
            <td className={cell}>
              <Field type="date" value={data.report_date} onChange={(v) => set?.("report_date", v)} readOnly={readOnly} missing={m("report_date")} />
            </td>
          </tr>

          {/* EPI */}
          <tr>
            <td className={`${cell} font-bold`} colSpan={6}>
              1. TODOS OS FUNCIONÁRIOS DA OBRA DA ATIVIDADE ESTÃO UTILIZANDO OS EPI's?
            </td>
            <td className={cell} colSpan={3}>
              <div className="flex gap-3 justify-center">
                <Check checked={data.epi_utilizado === true} onToggle={() => set?.("epi_utilizado", true)} readOnly={readOnly} label="SIM" missing={m("epi_utilizado")} />
                <Check checked={data.epi_utilizado === false} onToggle={() => set?.("epi_utilizado", false)} readOnly={readOnly} label="NÃO" />
              </div>
            </td>
            <td className={`${cell} font-bold text-center`} colSpan={2}>
              {data.criadouro === "outro" ? (
                <Field value={data.criadouro_outro} onChange={(v) => set?.("criadouro_outro", v)} readOnly={readOnly} placeholder="Outro criadouro" />
              ) : ""}
            </td>
            <td className={cell}></td>
          </tr>

          {/* === CABEÇALHOS DE BLOCO === */}
          <tr>
            <td className={head} colSpan={4}>CONDIÇÕES CLIMÁTICAS</td>
            <td className={head} colSpan={2}>QUALIDADE</td>
            <td className={head} colSpan={4}>PARALISAÇÕES DE OBRA</td>
            <td className={head} colSpan={2}>HORÁRIO DAS ATIVIDADES</td>
          </tr>
          <tr>
            <td className={subhead} rowSpan={2}>PERÍODO</td>
            <td className={subhead} colSpan={3}>TEMPO</td>
            <td className={subhead} colSpan={2} rowSpan={2}>
              <div className="space-y-1">
                <div className="flex justify-between gap-1">Ordem de Serviço
                  <span className="font-normal">
                    <Check checked={!!q.ordem_servico} onToggle={() => set?.("qualidade.ordem_servico", !q.ordem_servico)} readOnly={readOnly} label="Sim" missing={m("qualidade.ordem_servico")} />
                  </span>
                </div>
                <div className="flex justify-between gap-1">Bandeirola
                  <span className="font-normal">
                    <Check checked={!!q.bandeirola} onToggle={() => set?.("qualidade.bandeirola", !q.bandeirola)} readOnly={readOnly} label="Sim" missing={m("qualidade.bandeirola")} />
                  </span>
                </div>
                <div className="flex justify-between gap-1">Projeto
                  <span className="font-normal">
                    <Check checked={!!q.projeto} onToggle={() => set?.("qualidade.projeto", !q.projeto)} readOnly={readOnly} label="Sim" missing={m("qualidade.projeto")} />
                  </span>
                </div>
                <div className="text-left font-normal">
                  Obs: <Field value={q.obs} onChange={(v) => set?.("qualidade.obs", v)} readOnly={readOnly} className="w-full" />
                </div>
              </div>
            </td>
            <td className={subhead} colSpan={2}>MOTIVO</td>
            <td className={subhead}>INÍCIO</td>
            <td className={subhead}>FIM</td>
            <td className={subhead}>DIURNO</td>
            <td className={subhead}>NOTURNO</td>
          </tr>
          <tr>
            <td className={subhead}>Bom</td>
            <td className={subhead}>Chuva</td>
            <td className={subhead}>Improdutivo</td>
            <td className={subhead} colSpan={2}>—</td>
            <td className={subhead}></td>
            <td className={subhead}></td>
            <td className={subhead}>Hora Inicial</td>
            <td className={subhead}>Hora Inicial</td>
          </tr>

          {/* Linhas: Manhã / Tarde / Noite */}
          {(["manha", "tarde", "noite"] as const).map((p, idx) => {
            const labelP = p === "manha" ? "Manhã" : p === "tarde" ? "Tarde" : "Noite";
            const linhaPara = para[idx] || {};
            return (
              <tr key={p}>
                <td className={`${cell} font-bold text-center`}>{labelP}</td>
                {(["bom", "chuva", "improdutivo"] as const).map((tp) => (
                  <td key={tp} className={`${cell} text-center`}>
                    <Check checked={cc[p] === tp} onToggle={() => setCC(tp, p)} readOnly={readOnly} missing={m(`condicoes_climaticas.${p}`)} />
                  </td>
                ))}
                {idx === 0 && <td className={cell} colSpan={2} rowSpan={3}></td>}
                <td className={cell} colSpan={2}>
                  {readOnly ? (
                    <span>{linhaPara.motivo || ""}</span>
                  ) : (
                    <select
                      value={linhaPara.motivo || ""}
                      onChange={(e) => {
                        const arr = [...para];
                        while (arr.length <= idx) arr.push({});
                        arr[idx] = { ...arr[idx], motivo: e.target.value };
                        set?.("paralisacoes", arr);
                      }}
                      className="bg-transparent outline-none w-full text-[11px]"
                    >
                      <option value="">—</option>
                      {MOTIVOS_PARALISACAO.map((mot) => <option key={mot} value={mot}>{mot}</option>)}
                    </select>
                  )}
                </td>
                <td className={cell}>
                  <Field type="time" value={linhaPara.inicio} readOnly={readOnly} onChange={(v) => {
                    const arr = [...para]; while (arr.length <= idx) arr.push({}); arr[idx] = { ...arr[idx], inicio: v }; set?.("paralisacoes", arr);
                  }} />
                </td>
                <td className={cell}>
                  <Field type="time" value={linhaPara.fim} readOnly={readOnly} onChange={(v) => {
                    const arr = [...para]; while (arr.length <= idx) arr.push({}); arr[idx] = { ...arr[idx], fim: v }; set?.("paralisacoes", arr);
                  }} />
                </td>
                {idx === 0 && (
                  <>
                    <td className={cell} rowSpan={3}>
                      <div className="space-y-1">
                        <Field type="time" value={h.diurno?.inicio} readOnly={readOnly} onChange={(v) => set?.("horarios.diurno.inicio", v)} />
                        <div className="text-[10px]">Hora Final:</div>
                        <Field type="time" value={h.diurno?.fim} readOnly={readOnly} onChange={(v) => set?.("horarios.diurno.fim", v)} />
                      </div>
                    </td>
                    <td className={cell} rowSpan={3}>
                      <div className="space-y-1">
                        <Field type="time" value={h.noturno?.inicio} readOnly={readOnly} onChange={(v) => set?.("horarios.noturno.inicio", v)} />
                        <div className="text-[10px]">Hora Final:</div>
                        <Field type="time" value={h.noturno?.fim} readOnly={readOnly} onChange={(v) => set?.("horarios.noturno.fim", v)} />
                      </div>
                    </td>
                  </>
                )}
              </tr>
            );
          })}

          {/* === MÃO DE OBRA / EQUIPAMENTOS === */}
          <tr>
            <td className={head} colSpan={6}>MÃO DE OBRA</td>
            <td className={head} colSpan={6}>EQUIPAMENTOS / VEÍCULOS</td>
          </tr>
          <tr>
            <td className={subhead} colSpan={2}>DESCRIÇÃO DE CARGOS</td>
            <td className={subhead}>TERC.</td>
            <td className={subhead}>CONTRAT.</td>
            <td className={subhead} colSpan={2}>DESCRIÇÃO DE CARGOS</td>
            <td className={subhead} colSpan={2}>DESCRIÇÃO EQUIPAMENTOS</td>
            <td className={subhead}>TERC.</td>
            <td className={subhead} colSpan={2}>DESCRIÇÃO EQUIPAMENTOS</td>
            <td className={subhead}>CONTRAT.</td>
          </tr>
          {Array.from({ length: maxRows }).map((_, i) => {
            const lOrig = i * 2;
            const rOrig = i * 2 + 1;
            const l = mo[lOrig];
            const r = mo[rOrig];
            return (
              <tr key={`mo-${i}`}>
                <td className={cell} colSpan={2}><Field value={l?.cargo} onChange={(v) => updateMo(lOrig, "cargo", v)} readOnly={readOnly} /></td>
                <td className={cell}><Field type="number" value={l?.terc} onChange={(v) => updateMo(lOrig, "terc", Number(v) || 0)} readOnly={readOnly} className="text-center" /></td>
                <td className={cell}><Field type="number" value={l?.contrat} onChange={(v) => updateMo(lOrig, "contrat", Number(v) || 0)} readOnly={readOnly} className="text-center" /></td>
                <td className={cell} colSpan={2}><Field value={r?.cargo} onChange={(v) => updateMo(rOrig, "cargo", v)} readOnly={readOnly} /></td>
                {/* Equipamentos */}
                {(() => {
                  const eL = eq[i * 2];
                  const eR = eq[i * 2 + 1];
                  return (
                    <>
                      <td className={cell} colSpan={2}><Field value={eL?.descricao} onChange={(v) => updateEq(i * 2, "descricao", v)} readOnly={readOnly} /></td>
                      <td className={cell}><Field type="number" value={eL?.terc} onChange={(v) => updateEq(i * 2, "terc", Number(v) || 0)} readOnly={readOnly} className="text-center" /></td>
                      <td className={cell} colSpan={2}><Field value={eR?.descricao} onChange={(v) => updateEq(i * 2 + 1, "descricao", v)} readOnly={readOnly} /></td>
                      <td className={cell}><Field type="number" value={eR?.contrat} onChange={(v) => updateEq(i * 2 + 1, "contrat", Number(v) || 0)} readOnly={readOnly} className="text-center" /></td>
                    </>
                  );
                })()}
              </tr>
            );
          })}

          {/* === SERVIÇOS === */}
          <tr>
            <td className={orange} colSpan={6}>ESGOTO</td>
            <td className={blue} colSpan={6}>ÁGUA</td>
          </tr>
          <tr>
            <td className={subhead}>CÓDIGO</td>
            <td className={subhead} colSpan={3}>ATIVIDADES EXECUTADAS</td>
            <td className={subhead}>EXECUTADO</td>
            <td className={subhead}>UN</td>
            <td className={subhead}>CÓDIGO</td>
            <td className={subhead} colSpan={3}>ATIVIDADES EXECUTADAS</td>
            <td className={subhead}>EXECUTADO</td>
            <td className={subhead}>UN</td>
          </tr>
          {Array.from({ length: maxServ }).map((_, i) => {
            const e = esgoto[i];
            const a = agua[i];
            return (
              <tr key={`serv-${i}`}>
                <td className={cell}><Field value={e?.codigo} onChange={(v) => updateServ("servicos_esgoto", i, "codigo", v)} readOnly={readOnly} className="text-[10px]" /></td>
                <td className={cell} colSpan={3}><Field value={e?.descricao} onChange={(v) => updateServ("servicos_esgoto", i, "descricao", v)} readOnly={readOnly} className="text-[10px]" /></td>
                <td className={cell}><Field type="number" value={e?.quantidade} onChange={(v) => updateServ("servicos_esgoto", i, "quantidade", v)} readOnly={readOnly} className="text-center text-[10px]" /></td>
                <td className={cell}><Field value={e?.unidade} onChange={(v) => updateServ("servicos_esgoto", i, "unidade", v)} readOnly={readOnly} className="text-center text-[10px]" /></td>
                <td className={cell}><Field value={a?.codigo} onChange={(v) => updateServ("servicos_agua", i, "codigo", v)} readOnly={readOnly} className="text-[10px]" /></td>
                <td className={cell} colSpan={3}><Field value={a?.descricao} onChange={(v) => updateServ("servicos_agua", i, "descricao", v)} readOnly={readOnly} className="text-[10px]" /></td>
                <td className={cell}><Field type="number" value={a?.quantidade} onChange={(v) => updateServ("servicos_agua", i, "quantidade", v)} readOnly={readOnly} className="text-center text-[10px]" /></td>
                <td className={cell}><Field value={a?.unidade} onChange={(v) => updateServ("servicos_agua", i, "unidade", v)} readOnly={readOnly} className="text-center text-[10px]" /></td>
              </tr>
            );
          })}

          {/* === OBSERVAÇÕES + RESPONSÁVEIS === */}
          {(para.some((p: any) => p?.motivo === "Outro") || data.paralisacao_outro) && (
            <tr>
              <td className={`${cell} font-bold`} colSpan={3}>PARALISAÇÃO — OUTRO (descrever):</td>
              <td className={cell} colSpan={9}>
                <Field
                  value={data.paralisacao_outro}
                  onChange={(v) => set?.("paralisacao_outro", v)}
                  readOnly={readOnly}
                  placeholder="Descreva o motivo da paralisação"
                />
              </td>
            </tr>
          )}
          <tr>
            <td className={`${head}`} colSpan={12}>OBSERVAÇÕES</td>
          </tr>
          <tr>
            <td className={cell} colSpan={12}>
              {readOnly ? (
                <div className="whitespace-pre-wrap min-h-[40px]">{data.observacoes || "—"}</div>
              ) : (
                <textarea
                  value={data.observacoes || ""}
                  onChange={(e) => set?.("observacoes", e.target.value)}
                  rows={3}
                  className="w-full bg-transparent outline-none text-[11px]"
                />
              )}
            </td>
          </tr>
          <tr>
            <td className={`${cell} text-center`} colSpan={6}>
              <div className="border-t border-black mt-6 pt-1 text-[10px]">
                {data.assinatura_empreiteira_url && (
                  <img src={data.assinatura_empreiteira_url} alt="Assinatura empreiteira" className="h-12 mx-auto object-contain" />
                )}
                <Field value={data.responsavel_empreiteira} onChange={(v) => set?.("responsavel_empreiteira", v)} readOnly={readOnly} className="text-center" placeholder="Nome" />
                <div>RESPONSÁVEL DA EMPREITEIRA</div>
              </div>
            </td>
            <td className={`${cell} text-center`} colSpan={6}>
              <div className="border-t border-black mt-6 pt-1 text-[10px]">
                {data.assinatura_consorcio_url && (
                  <img src={data.assinatura_consorcio_url} alt="Assinatura consórcio" className="h-12 mx-auto object-contain" />
                )}
                <Field value={data.responsavel_consorcio} onChange={(v) => set?.("responsavel_consorcio", v)} readOnly={readOnly} className="text-center" placeholder="Nome" />
                <div>RESPONSÁVEL DO CONSÓRCIO</div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * Lista de campos obrigatórios do cabeçalho. Retorna Set de paths faltantes.
 */
export function getMissingRequired(data: any): Set<string> {
  const missing = new Set<string>();
  const required: Array<[string, () => boolean]> = [
    ["report_date", () => !data.report_date],
    ["rua_beco", () => !data.rua_beco?.trim()],
    ["encarregado", () => !data.encarregado?.trim()],
    ["criadouro", () => !data.criadouro],
    ["epi_utilizado", () => data.epi_utilizado !== true && data.epi_utilizado !== false],
    ["condicoes_climaticas.manha", () => !data.condicoes_climaticas?.manha],
    ["condicoes_climaticas.tarde", () => !data.condicoes_climaticas?.tarde],
    ["condicoes_climaticas.noite", () => !data.condicoes_climaticas?.noite],
  ];
  for (const [p, f] of required) if (f()) missing.add(p);
  // qualidade: ao menos um marcado
  const q = data.qualidade || {};
  if (!q.ordem_servico && !q.bandeirola && !q.projeto) {
    missing.add("qualidade.ordem_servico");
    missing.add("qualidade.bandeirola");
    missing.add("qualidade.projeto");
  }
  return missing;
}

export const REQUIRED_LABELS: Record<string, string> = {
  report_date: "Data",
  rua_beco: "Rua / Beco",
  encarregado: "Encarregado",
  criadouro: "Criadouro",
  epi_utilizado: "EPI utilizado (Sim/Não)",
  "condicoes_climaticas.manha": "Condição climática — Manhã",
  "condicoes_climaticas.tarde": "Condição climática — Tarde",
  "condicoes_climaticas.noite": "Condição climática — Noite",
  "qualidade.ordem_servico": "Qualidade (marcar OS, Bandeirola ou Projeto)",
  "qualidade.bandeirola": "Qualidade (marcar OS, Bandeirola ou Projeto)",
  "qualidade.projeto": "Qualidade (marcar OS, Bandeirola ou Projeto)",
};