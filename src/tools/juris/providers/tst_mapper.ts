// ============================================================================
// Mapeadores e Parsers de Registros/HTML do TST (docgov-engine v1.7.3)
// ============================================================================

import type { RawJurisFetchResult, RawJurisSearchResult } from "../types.ts";
import { cleanHtmlAndNormalize } from "../anatomical_slicer.ts";

export function parseCnjLaborRef(ref: string) {
  const clean = ref.trim().replace(/^TST[-_]/i, "");
  const punctMatch = clean.match(
    /\b(\d{1,7})[-.](\d{2})[-.](\d{4})[-.]5[-.](\d{2})[-.](\d{4})\b/
  );
  if (punctMatch) {
    return {
      numero: parseInt(punctMatch[1], 10).toString(),
      digito: punctMatch[2],
      ano: punctMatch[3],
      orgao: "5",
      tribunal: punctMatch[4].padStart(2, "0"),
      vara: punctMatch[5].padStart(4, "0"),
    };
  }
  const pure20Match = clean.match(
    /\b(\d{7})(\d{2})((?:19|20)\d{2})(5)(\d{2})(\d{4})\b/
  );
  if (pure20Match) {
    return {
      numero: parseInt(pure20Match[1], 10).toString(),
      digito: pure20Match[2],
      ano: pure20Match[3],
      orgao: "5",
      tribunal: pure20Match[5].padStart(2, "0"),
      vara: pure20Match[6].padStart(4, "0"),
    };
  }
  return null;
}

export function mapTstRecordToResult(reg: any): RawJurisSearchResult {
  const tipoCode = String(
    reg.tipo?.codigoTipoJurisprudencia || reg.tipo || ""
  ).toUpperCase();
  const dataSessao = reg.dtaJulgamento || reg.dtaPublicacao || reg.dataPublicacao;
  const rawAno = dataSessao
    ? parseInt(String(dataSessao).slice(0, 4), 10)
    : reg.anoProc !== undefined && reg.anoProc !== null
    ? Number(reg.anoProc)
    : undefined;
  const ano = rawAno !== undefined && Number.isFinite(rawAno) ? rawAno : undefined;

  if (tipoCode === "SUM" || tipoCode === "OJ") {
    const numStr = String(reg.numero || "").trim();
    const orgaoDesc =
      reg.orgaoJudicante?.descricao ||
      (tipoCode === "SUM" ? "Tribunal Pleno" : "SBDI-1");
    const isSdi1 = /subse[çc][ãa]o\s+i\b|sbdi[-_\s]?1/i.test(orgaoDesc);
    const id =
      tipoCode === "SUM"
        ? numStr
          ? `SUMULA-TST-${numStr}`
          : `SUMULA-TST-${reg.id}`
        : numStr
        ? isSdi1
          ? `OJ-TST-SDI1-${numStr}`
          : `OJ-TST-${numStr}`
        : `OJ-TST-${reg.id}`;
    const titulo = cleanHtmlAndNormalize(reg.titulo || "");
    const sit = reg.situacao?.descricao
      ? `Situação: ${reg.situacao.descricao}`
      : "";
    const obs = cleanHtmlAndNormalize(reg.observacao || "");
    const teseClean = cleanHtmlAndNormalize(reg.tese || reg.teseHighlight || "");
    return {
      id,
      court: "TST",
      colegiado: orgaoDesc,
      numero: numStr,
      ano,
      processo: id,
      relator: tipoCode === "SUM" ? "Tribunal Pleno TST" : orgaoDesc,
      dataSessao,
      entidade: reg.entidade || "NAO_INFORMADA",
      indexacao: [titulo, sit].filter(Boolean).join("; "),
      tese: [titulo, teseClean, obs ? `Observação: ${obs}` : ""]
        .filter(Boolean)
        .join(" — "),
      dispositivo: sit || titulo || undefined,
      rawPayload: { ...reg },
    };
  }

  const numFmt = reg.numFormatado
    ? String(reg.numFormatado).replace(/\s+/g, " ")
    : "";
  const canonicalNum = numFmt
    ? numFmt.replace(/\s+/g, "")
    : reg.numero || "S/N";
  const id =
    reg.id && /^TST-/i.test(String(reg.id))
      ? String(reg.id)
      : `TST-${canonicalNum}`;
  const tags: string[] = [];
  if (Array.isArray(reg.temaProcs)) {
    for (const t of reg.temaProcs) {
      if (t && typeof t === "object" && t.desTemaProc) tags.push(t.desTemaProc);
    }
  }
  if (Array.isArray(reg.indicadores)) {
    for (const ind of reg.indicadores) {
      if (ind && typeof ind === "object" && ind.desIndicador) {
        tags.push(ind.desIndicador);
      }
    }
  }
  const ementa = reg.ementa || reg.txtEmentaHighlight || reg.tese || "";
  return {
    id,
    court: "TST",
    colegiado: reg.orgaoJudicante?.descricao || reg.colegiado || "Turma",
    numero: String(reg.numero || reg.numProc || ""),
    ano,
    processo: numFmt || `TST ${canonicalNum}`,
    relator:
      reg.nomRelatorSemTratamento ||
      reg.nomRelator ||
      reg.relator ||
      "Ministro Relator",
    dataSessao,
    entidade: reg.entidade || "NAO_INFORMADA",
    indexacao: tags.join("; ") || reg.indexacao || "",
    tese: typeof ementa === "string" ? cleanHtmlAndNormalize(ementa) : ementa,
    dispositivo: reg.dispositivo
      ? cleanHtmlAndNormalize(reg.dispositivo)
      : undefined,
    rawPayload: { ...reg, tstUuid: reg.id },
  };
}

export function buildTstNormativeFetchResult(
  idOrRef: string,
  kind: "SUM" | "OJ",
  rec: any
): RawJurisFetchResult {
  const mapped = mapTstRecordToResult(rec);
  const titulo = cleanHtmlAndNormalize(rec.titulo || "");
  const tese = cleanHtmlAndNormalize(rec.tese || "");
  const obs = cleanHtmlAndNormalize(rec.observacao || "");
  const hist = cleanHtmlAndNormalize(rec.historico || "");
  const sit = rec.situacao?.descricao
    ? `Situação: ${rec.situacao.descricao}`
    : "";
  const fullText = [
    titulo,
    sit,
    tese,
    obs ? `Observação: ${obs}` : "",
    hist ? `Histórico: ${hist}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    id: idOrRef,
    court: "TST",
    exists: true,
    source: "LIVE",
    rawTextOrJson: {
      ...rec,
      id: mapped.id,
      tribunal: "TST",
      numero: String(rec.numero || mapped.numero),
      ano: mapped.ano,
      processo: mapped.id,
      colegiado: mapped.colegiado,
      relator: kind === "SUM" ? "Tribunal Pleno TST" : "SBDI-1 TST",
      dataSessao: mapped.dataSessao,
      entidade: "NAO_INFORMADA",
      indexacao: mapped.indexacao,
      ementa: mapped.tese,
      tese: mapped.tese,
      voto: [obs, hist].filter(Boolean).join("\n\n") || tese,
      dispositivo: sit || titulo || tese,
      inteiroTeorTexto: fullText,
      rawText: fullText,
    },
  };
}

export function buildTstFetchResultFromHtml(
  idOrRef: string,
  tstUuid: string,
  initialRecord: any,
  htmlBody: string
): RawJurisFetchResult {
  const cleanFullText = cleanHtmlAndNormalize(htmlBody);
  const relatorioMatch = cleanFullText.match(
    /(?:R\s*E\s*L\s*A\s*T\s*Ó\s*R\s*I\s*O|Vistos,\s*relatados[\s\S]*?)([\s\S]*?)(?=V\s*O\s*T\s*O|I\s*-\s*CONHECIMENTO|FUNDAMENTAÇÃO|ISTO\s+POSTO|ACORDAM|$)/i
  );
  const votoMatch = cleanFullText.match(
    /(?:V\s*O\s*T\s*O|FUNDAMENTAÇÃO|I\s*-\s*CONHECIMENTO)([\s\S]*?)(?=ISTO\s+POSTO|ACORDAM|$)/i
  );
  const dispositivoMatch = cleanFullText.match(
    /(?:ISTO\s+POSTO[\s\S]*?)?(?:ACORDAM[\s\S]*?)(?=(?:Bras[íi]lia|Firmado\s+por|\n\s*Ministr[oa]|$))/i
  );

  const numFmt = initialRecord?.numFormatado
    ? String(initialRecord.numFormatado).replace(/\s+/g, " ")
    : idOrRef;
  const canonicalNum = numFmt.replace(/\s+/g, "");
  const dataSessao =
    initialRecord?.dtaJulgamento || initialRecord?.dtaPublicacao;
  const rawAno = dataSessao
    ? parseInt(String(dataSessao).slice(0, 4), 10)
    : initialRecord?.anoProc !== undefined && initialRecord?.anoProc !== null
    ? Number(initialRecord.anoProc)
    : undefined;
  const ano = rawAno !== undefined && Number.isFinite(rawAno) ? rawAno : undefined;
  const ementaText =
    initialRecord?.ementa ||
    initialRecord?.txtEmentaHighlight ||
    cleanFullText.slice(0, 1500);

  return {
    id: idOrRef,
    court: "TST",
    exists: true,
    source: "LIVE",
    rawTextOrJson: {
      ...(initialRecord || {}),
      id: `TST-${canonicalNum}`,
      numero: initialRecord?.numero
        ? String(initialRecord.numero)
        : canonicalNum,
      processo: numFmt,
      colegiado: initialRecord?.orgaoJudicante?.descricao || "Turma",
      relator:
        initialRecord?.nomRelatorSemTratamento ||
        initialRecord?.nomRelator ||
        "Ministro Relator",
      dataSessao,
      ano,
      entidade: initialRecord?.entidade || "NAO_INFORMADA",
      ementa: ementaText,
      tese: ementaText,
      relatorio: relatorioMatch ? relatorioMatch[0].trim() : undefined,
      voto: votoMatch ? votoMatch[0].trim() : cleanFullText,
      acordao: dispositivoMatch
        ? dispositivoMatch[0].trim()
        : initialRecord?.dispositivo,
      dispositivo: dispositivoMatch
        ? dispositivoMatch[0].trim()
        : initialRecord?.dispositivo,
      inteiroTeorHtml: htmlBody,
      inteiroTeorTexto: cleanFullText,
      rawText: cleanFullText,
      rawPayload: { ...(initialRecord || {}), tstUuid },
    },
  };
}
