// ============================================================================
// Seções do Ofício e E-mail de Diligência Investigativa de Veracidade de ACT
// docgov-engine v1.6.1 — src/bidding/act_diligence_letter_sections.ts
// ============================================================================

import type { BiddingProposalDossier } from "./types.ts";
import {
  pDocHeader,
  pHeading,
  pBody,
  pBullet,
  pCallout,
  buildTableXml,
  pSignatureBlock,
} from "./bidding_xml_primitives.ts";
import {
  isLei13303Regime,
  formatLegalRegime,
  formatBRL,
  formatDateBR,
  formatNumberBR,
  translateForensicVectorName,
} from "./bidding_legal_humanizer.ts";

export function buildActDiligenceLetterXmlParts(dossier: BiddingProposalDossier): string[] {
  const is13303 = isLei13303Regime(dossier.legal_regime);
  const rawActs = dossier.raw_context?.act_forensic_items || [];

  const actRows = dossier.act_forensics.items.map((a, idx) => {
    const raw = rawActs[idx] || {};
    const vectorsHuman =
      a.triggered_vectors.length > 0
        ? a.triggered_vectors.map((v) => translateForensicVectorName(v)).join("\n")
        : "Nenhum vetor suspeito acionado";
    const evidenceSummary =
      a.details.length > 0
        ? a.details.join("\n")
        : `Emissor regularizado (${raw.issuer_porte || "Porte N/A"}, CNAE ${raw.issuer_cnae_primary || "N/A"}).`;
    return [
      `${a.certificate_id}\nData ACT: ${formatDateBR(raw.act_issue_date)}`,
      `${a.issuer_name}\nCNPJ: ${a.issuer_cnpj}\nRFB: ${raw.issuer_cnpj_status || "Não inf."}`,
      vectorsHuman,
      `${evidenceSummary}\n${a.blocking_tags.join(" ") || "CONFORME"}`,
    ];
  });

  const issuerListText =
    dossier.act_forensics.items.length > 0
      ? dossier.act_forensics.items
          .map(
            (a) =>
              `${a.certificate_id} — Emissor ${a.issuer_name} (CNPJ ${a.issuer_cnpj}): ${a.details.join(" ") || "Confirmação cadastral e material requerida."}`
          )
          .join(" ")
      : "Confirmação cadastral, material e documental dos atestados submetidos ao procedimento.";

  const needPriceDiligence =
    dossier.ict_execution.diligence_required || !dossier.ict_execution.is_exequible;

  const parts: string[] = [
    pDocHeader(
      `ORGAO_CONTRATANTE — COMISSÃO DE CONTRATAÇÃO / PREGOEIRO (${formatLegalRegime(dossier.legal_regime)})`,
      `OFÍCIO E E-MAIL DE DILIGÊNCIA INVESTIGATIVA DE VERACIDADE DE ATESTADOS (ACT) — ${dossier.process_id}`,
      `Instrumento de Diligência Dupla (Via A ao Emissor e Via B à Licitante) | Art. 64 da Lei nº 14.133/2021${is13303 ? " c/c Art. 56, § 2º da Lei nº 13.303/2016" : ""}`
    ),
    pBody(
      `Fundamentação Normativa e Jurisprudencial: Art. 64 da Lei Federal nº 14.133/2021${is13303 ? ", Art. 56, § 2º e Art. 83 da Lei Federal nº 13.303/2016" : ""}, Decreto/Normativos de Regência e jurisprudência vinculante do Tribunal de Contas da União (Acórdãos TCU nº 1.385/2016-Plenário e nº 1.211/2021-Plenário${needPriceDiligence ? "; Súmula TCU nº 262" : ""}).`,
      true
    ),

    // PARTE I
    pHeading("PARTE I — Quadro Diagnóstico dos Atestados Submetidos à Diligência Forense", 1),
    pBody(
      `Durante o exame de habilitação técnica da licitante ${dossier.bidder_name} (CNPJ ${dossier.bidder_cnpj}) no processo ${dossier.process_id}, o módulo de auditoria pericial identificou ${dossier.act_forensics.total_alerts} alerta(s) objetivo(s) nos ${dossier.act_forensics.certificates_audited} atestado(s) analisado(s), exigindo a imediata deflagração de diligência investigativa em dupla via para apuração da veracidade material e documental:`
    ),
    buildTableXml(
      ["Atestado", "Emissor e Situação RFB", "Vetores Forenses Acionados", "Evidências Apuradas e Rastreabilidade"],
      actRows.length > 0
        ? actRows
        : [["Sem ACT listado", "Não informado", "Verificação geral", "Nenhuma pendência tabular registrada"]],
      [1.3, 2.2, 2.4, 3.2]
    ),

    // PARTE II — VIA A
    pHeading("PARTE II — VIA A: Minuta de Ofício / E-mail Direto ao Emissor do ACT (Canais Oficiais Receita Federal)", 1),
    pCallout(
      "DIRETRIZ DE COMUNICAÇÃO OFICIAL (CANAL PROBATÓRIO INDEPENDENTE)",
      "A presente comunicação DEVE ser remetida exclusivamente aos endereços eletrônicos e postais oficiais do Emissor constantes da base cadastral da Receita Federal do Brasil (RFB) ou do Portal de Compras/Transparência correspondente, sendo vedado utilizar exclusivamente telefones ou e-mails indicados no corpo do próprio atestado suspeito.",
      "info"
    ),
    pBody(
      `ASSUNTO: Solicitação Oficial de Confirmação de Autenticidade e Execução de Atestado de Capacidade Técnica — Processo ${dossier.process_id} — Licitante: ${dossier.bidder_name} (CNPJ ${dossier.bidder_cnpj}).`,
      true
    ),
    pBody(
      `Prezado(a) Representante Legal / Dirigente da Entidade Emissora, na qualidade de Agente de Contratação / Pregoeiro do ORGAO_CONTRATANTE, no exercício do poder-dever de diligência administrativa conferido pelo Art. 64 da Lei nº 14.133/2021${is13303 ? " e pelo Art. 56, § 2º da Lei nº 13.303/2016" : ""} (Acórdão TCU nº 1.385/2016-Plenário), solicitamos a Vossa Senhoria manifestação formal, no prazo de 3 (três) a 5 (cinco) dias úteis a contar do recebimento deste expediente oficial enviado via contatos cadastrais da Receita Federal (RFB), confirmando os seguintes pontos referentes ao(s) atestado(s) emitido(s) em favor da licitante:`
    ),
    pBullet(
      "Item 1 — Autenticidade da Subscrição e Autoria",
      `Confirmar expressamente se o documento foi efetivamente expedido e assinado pelo Emissor indicado (${issuerListText}), informando nome completo, cargo e CPF funcional do signatário.`
    ),
    pBullet(
      "Item 2 — Efetiva Execução Técnica, Período e Volume",
      "Confirmar a efetiva execução dos serviços de Tecnologia da Informação e Comunicação (TIC) descritos no atestado, detalhando a data de início, data de conclusão, escopo real entregue e quantitativos efetivamente executados e medidos."
    ),
    pBullet(
      "Item 3 — Vínculo Contratual e Lastro Fiscal Correspondente",
      "Indicar o número do contrato administrativo ou privado, eventual registro público (PNCP/empenho, se ente público ou estatal) e a relação das Notas Fiscais Eletrônicas emitidas em contraprestação, esclarecendo pontualmente os achados preliminares de cadastro, cronologia ou volume apontados."
    ),
    pCallout(
      "ADVERTÊNCIA LEGAL AO EMISSOR (RESPONSABILIDADE PENAL E ADMINISTRATIVA)",
      "Ressalta-se que a expedição, confirmação inverídica ou uso de atestado ideológica ou materialmente falso sujeita os responsáveis às sanções penais previstas nos Arts. 299 (Falsidade Ideológica) e 337-I (Perturbação ou Fraude à Licitação) do Código Penal Brasileiro, além de comunicação imediata ao Ministério Público e aos órgãos de controle externo.",
      "warn"
    ),

    // PARTE III — VIA B
    pHeading("PARTE III — VIA B: Minuta de Intimação Formal à Licitante para Apresentação de Lastro Material", 1),
    pBody(
      `DESTINATÁRIA: ${dossier.bidder_name} | CNPJ nº ${dossier.bidder_cnpj} | Processo: ${dossier.process_id}.`,
      true
    ),
    pBody(
      `Fica Vossa Senhoria formalmente INTIMADA a apresentar, no prazo improrrogável de 3 (três) a 5 (cinco) dias úteis (nos termos do Art. 64 da Lei nº 14.133/2021${is13303 ? " c/c Art. 56, § 2º da Lei nº 13.303/2016" : ""} e da jurisprudência dos Acórdãos TCU nº 1.211/2021 e nº 1.385/2016-Plenário), o lastro material probatório integral que comprove a efetiva realização dos serviços atestados em seu favor${needPriceDiligence ? `, bem como a composição analítica de custos unitários exigida pela Súmula TCU nº 262 diante da oferta unitária de ${formatBRL(dossier.ict_execution.offered_unit_value)} frente ao piso paramétrico apurado de ${formatBRL(dossier.ict_execution.parametric_floor_value)}` : ""}.`
    ),
    pHeading("Relação Taxativa de Documentos Comprobatórios Exigidos da Licitante", 2),
    pBullet(
      "1. Notas Fiscais Eletrônicas Autenticáveis",
      "Cópia integral das NF-e / NFS-e emitidas para o contratante Emissor do ACT, contendo obrigatoriamente a chave de acesso completa de 44 dígitos (ou código verificador municipal equivalente com protocolo de autenticidade fiscal)."
    ),
    pBullet(
      "2. Contrato Original e Aditivos",
      "Via integral do Contrato de prestação de serviços firmado à época entre a licitante e o Emissor, acompanhada de eventuais termos aditivos, propostas comerciais anexas e comprovantes de assinatura contemporâneos."
    ),
    pBullet(
      "3. Ordens de Serviço e Termos de Recebimento",
      "Ordens de Serviço (OS), relatórios técnicos de medição mensal, entregas homologadas (ANS) e termos de recebimento provisório ou definitivo subscritos pelo contratante."
    ),
    pBullet(
      "4. Lastro Trabalhista, Previdenciário e Liquidação Financeira",
      "Guias e relatórios trabalhistas/previdenciários referentes à equipe técnica alocada no período atestado (SEFIP / GFIP e eventos do eSocial), bem como comprovantes bancários de liquidação/recebimento das faturas (TED, DOC, PIX ou extratos identificados)."
    ),
  ];

  if (needPriceDiligence) {
    parts.push(
      pBullet(
        "5. Planilha Analítica de Exequibilidade (Súmula TCU nº 262)",
        `Memória de cálculo pormenorizada de formação de preços da proposta (salários-base dos perfis de TI, encargos sociais, tributos, custos indiretos e margem), demonstrando a viabilidade econômica de execução no valor ofertado de ${formatBRL(dossier.ict_execution.offered_unit_value)} (referencial paramétrico: ${formatBRL(dossier.ict_execution.parametric_floor_value)}; quantidade técnica convertida: ${formatNumberBR(dossier.qualification.converted_total_quantity, 2)}).`
      )
    );
  }

  parts.push(
    pCallout(
      "CONSEQUÊNCIAS DO DESCUMPRIMENTO OU CONSTATAÇÃO DE INIDONEIDADE",
      `O não atendimento tempestivo à presente intimação, a recusa em exibir o lastro fiscal e trabalhista solicitado ou a confirmação de inautenticidade/simulação documental ensejará a imediata inabilitação ou desclassificação da licitante no certame, sem prejuízo da instauração de Processo Administrativo Sancionador (PAS) por apresentação de declaração ou documentação falsa (${is13303 ? "Art. 83 da Lei nº 13.303/2016 e RILC" : "Art. 155, inciso VIII e Art. 156 da Lei nº 14.133/2021"}), aplicação de declaração de inidoneidade / suspensão cadastral e remessa dos autos ao Ministério Público e ao Tribunal de Contas competente.`,
      "danger"
    ),
    ...pSignatureBlock([
      "Pregoeiro(a) / Agente de Contratação — ORGAO_CONTRATANTE",
      "Comissão de Contratação / Equipe de Apoio Técnico em TIC",
    ])
  );

  return parts;
}
