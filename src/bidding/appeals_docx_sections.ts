import { formatLegalRegime } from "./bidding_legal_humanizer.ts";
import {
  pDocHeader,
  pHeading,
  pBody,
  pBullet,
  pCallout,
  buildTableXml,
  pSignatureBlock,
} from "./bidding_xml_primitives.ts";
import type { BiddingProposalDossier } from "./types.ts";

export function buildAppealPetitionXmlParts(
  dossier: BiddingProposalDossier
): string[] {
  const ctx = dossier.appeals_evaluation;
  const appealCtx = dossier.raw_context?.appeal_context;
  const isCounter =
    String(appealCtx?.appeal_type || "").toUpperCase() === "CONTRARRAZOES";
  const pieceTitle = isCounter
    ? "CONTRARRAZÕES AO RECURSO ADMINISTRATIVO"
    : "RAZÕES DE RECURSO ADMINISTRATIVO";

  const parts: string[] = [];
  parts.push(
    pDocHeader(
      `FASE RECURSAL — PROCESSO ${dossier.process_id}`,
      pieceTitle,
      `Fundamentação sob a ${formatLegalRegime(dossier.legal_regime)} (Arts. 165 e 168)`
    )
  );

  parts.push(pHeading("1. Tempestividade, Admissibilidade e Vinculação Temática (Art. 165)", 1));
  parts.push(
    buildTableXml(
      ["Requisito Legal", "Status Determinístico", "Fundamento Normativo"],
      [
        [
          "Intenção Imediata de Recorrer",
          ctx?.immediate_intent_valid !== false ? "Admitida na Sessão" : "Preclusa",
          "Art. 165, § 1º, I da Lei 14.133/2021",
        ],
        [
          "Prazo de 3 Dias Úteis (Razões/Contrarrazões)",
          ctx?.timely_3_business_days !== false ? "Tempestivo (<= 3 dias úteis)" : "Intempestivo",
          "Art. 165, I e § 4º da Lei 14.133/2021",
        ],
        [
          "Vinculação Temática à Intenção Motivada",
          ctx?.thematic_link_ok !== false ? "Observada" : "Inovação Indevida Detectada",
          "Jurisprudência Consolidada TCU",
        ],
        [
          "Efeito Devolutivo e Suspensivo Automático",
          ctx?.suspensive_effect_applicable ? "Aplicável (Art. 168)" : "Avaliar caso concreto",
          "Art. 168 da Lei 14.133/2021",
        ],
      ],
      [2.2, 1.8, 2.0]
    )
  );

  parts.push(pHeading("2. Síntese Fática e Fundamentos Técnicos-Jurídicos", 1));
  parts.push(
    pBody(
      appealCtx?.summary_reasons ||
        appealCtx?.summary_counter_reasons ||
        `Recorrente/Interessada: ${appealCtx?.appellant_name || dossier.bidder_name} (${
          appealCtx?.appellant_cnpj || dossier.bidder_cnpj
        }). Escopo temático registrado: ${
          appealCtx?.declared_intent_scope || "Habilitação / Julgamento de Proposta"
        }.`
    )
  );

  if (dossier.blocking_tags.length > 0) {
    parts.push(pHeading("3. Pontos Controvertidos e Óbices Técnicos Mapeados", 1));
    for (const tag of dossier.blocking_tags) {
      parts.push(pBullet("Óbice Identificado", tag));
    }
  }

  parts.push(pHeading("4. Requerimento Conclusivo", 1));
  parts.push(
    pCallout(
      isCounter ? "Requerimento de Manutenção do Ato" : "Requerimento de Efeito Suspensivo e Reconsideração",
      isCounter
        ? "Diante do exposto, requer-se o não provimento do recurso administrativo interposto, mantendo-se integralmente a decisão da sessão pública e o regular prosseguimento do certame."
        : "Diante do exposto, requer-se o recebimento das presentes razões no efeito suspensivo (Art. 168), o juízo de reconsideração pelo Pregoeiro/Agente de Contratação (Art. 165, § 2º) ou, subsidiariamente, a remessa à Autoridade Superior em até 10 dias úteis.",
      "info"
    )
  );
  parts.push(
    ...pSignatureBlock([
      `Representante / Peticionário — ${dossier.bidder_name || appealCtx?.appellant_name || "Licitante"}`,
    ])
  );

  return parts;
}

export function buildPregoeiroDecisionXmlParts(
  dossier: BiddingProposalDossier
): string[] {
  const ctx = dossier.appeals_evaluation;
  const appealCtx = dossier.raw_context?.appeal_context;
  const admissible =
    ctx?.immediate_intent_valid !== false &&
    ctx?.timely_3_business_days !== false &&
    ctx?.thematic_link_ok !== false;

  const parts: string[] = [];
  parts.push(
    pDocHeader(
      `JUÍZO DE ADMISSIBILIDADE E RECONSIDERAÇÃO — ${dossier.process_id}`,
      "DECISÃO DO PREGOEIRO E ENCAMINHAMENTO À AUTORIDADE SUPERIOR",
      `Exame fundamentado no Art. 165, § 2º e Art. 168 da ${formatLegalRegime(
        dossier.legal_regime
      )}`
    )
  );

  parts.push(pHeading("1. Juízo Prévio de Admissibilidade Recursal", 1));
  parts.push(
    buildTableXml(
      ["Critério", "Constatação Objetiva"],
      [
        ["Recorrente", `${appealCtx?.appellant_name || dossier.bidder_name}`],
        ["Intenção Imediata", ctx?.immediate_intent_valid !== false ? "Regular" : "Ausente / Preclusa"],
        ["Tempestividade (3 dias úteis)", ctx?.timely_3_business_days !== false ? "Tempestivo" : "Intempestivo"],
        ["Vinculação Temática", ctx?.thematic_link_ok !== false ? "Aderente" : "Inovação Recursal"],
        ["Efeito Suspensivo (Art. 168)", admissible ? "Ativado até decisão final" : "Recurso inadmitido"],
      ],
      [2.0, 3.0]
    )
  );

  parts.push(pHeading("2. Análise de Mérito e Juízo de Reconsideração (Art. 165, § 2º)", 1));
  const findings = ctx?.findings.length
    ? ctx.findings
    : dossier.act_forensics.items.flatMap((i) => i.details);
  if (findings.length > 0) {
    for (const f of findings) {
      parts.push(pBullet("Fundamento Técnico", f));
    }
  } else {
    parts.push(
      pBody(
        "Após verificação objetiva dos autos, das planilhas e dos metadados documentais, mantêm-se os fundamentos técnicos do julgamento proferido na sessão pública."
      )
    );
  }

  parts.push(pHeading("3. Dispositivo e Prazo da Autoridade Superior (10 Dias Úteis)", 1));
  parts.push(
    pCallout(
      admissible ? "Encaminhamento Hierárquico no Efeito Suspensivo" : "Inadmissão Formal do Recurso",
      admissible
        ? `Nos termos do Art. 165, § 2º da Lei 14.133/2021, não havendo retratação integral, encaminham-se os autos devidamente instruídos à Autoridade Superior competente, a qual deverá proferir decisão definitiva no prazo máximo de ${
            ctx?.authority_forwarding_deadline_days ?? 10
          } (dez) dias úteis.`
        : "Não conhecido o recurso em sede de admissibilidade por óbice formal peremptório (preclusão/intempestividade/inovação), submetendo-se à ciência da Autoridade Superior.",
      admissible ? "warn" : "danger"
    )
  );
  parts.push(
    ...pSignatureBlock([
      `Agente de Contratação / Pregoeiro — ${dossier.raw_context?.contracting_agency || "ORGAO_CONTRATANTE"}`,
    ])
  );

  return parts;
}
