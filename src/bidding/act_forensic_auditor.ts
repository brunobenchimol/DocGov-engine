// ============================================================================
// Módulo 9.2.B: Motor Forense Anti-Fraude de ACT (7 Vetores Determinísticos)
// docgov-engine v1.6.0 — src/bidding/act_forensic_auditor.ts
// ============================================================================

import type {
  ActForensicItemInput,
  ActForensicFinding,
  ActForensicEvaluation,
} from "./types.ts";

function parseDateMs(iso?: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

function tokenizeNormalized(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

function computeJaccardSimilarity(a: string, b: string): number {
  const tokensA = new Set(tokenizeNormalized(a));
  const tokensB = new Set(tokenizeNormalized(b));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function hasCommonQsaPartner(a: string[] = [], b: string[] = []): boolean {
  const normA = new Set(a.map((x) => x.trim().toLowerCase()).filter(Boolean));
  for (const p of b) {
    if (normA.has(p.trim().toLowerCase())) return true;
  }
  return false;
}

export function auditActForensics(
  items: ActForensicItemInput[] = []
): ActForensicEvaluation {
  const allTagsSet = new Set<string>();
  const findings: ActForensicFinding[] = [];
  let totalAlerts = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const certId = item.certificate_id || `ACT-${i + 1}`;
    const issuerName = item.issuer_name || "EMISSOR_NAO_IDENTIFICADO";
    const issuerCnpj = item.issuer_cnpj || "00.000.000/0000-00";
    const triggered_vectors: string[] = [];
    const itemTags: string[] = [];
    const details: string[] = [];

    // Vetor 1: Porte e CNAE do Emissor (BrasilAPI/RFB + Mock Determinístico)
    const incompatiblePorte =
      (item.issuer_porte || "").toUpperCase() === "MEI" &&
      Number(item.attested_volume || 0) >= 10000;
    const cnaeMismatch = item.issuer_cnae_compatible_with_ict === false;
    if (cnaeMismatch || incompatiblePorte) {
      triggered_vectors.push("VETOR_1_PORTE_CNAE");
      itemTags.push("[ACT_ISSUER_CNAE_OR_SCALE_MISMATCH_SUSPICION]");
      details.push(
        `Vetor 1 (Porte/CNAE): Emissor '${issuerName}' (${item.issuer_porte || "N/A"}, CNAE ${item.issuer_cnae_primary || "N/A"}) incompatível com o escopo/volume de TIC atestado.`
      );
    }

    // Vetor 2: Cronologia Impossível e Status Cadastral do CNPJ
    const statusUpper = (item.issuer_cnpj_status || "ATIVA").toUpperCase();
    const inactiveStatus = ["BAIXADA", "INAPTA", "SUSPENSA", "NULA"].includes(statusUpper);
    const openMs = parseDateMs(item.issuer_opening_date);
    const execStartMs = parseDateMs(item.execution_start_date);
    const statusMs = parseDateMs(item.issuer_status_date);
    const issueMs = parseDateMs(item.act_issue_date);

    const impossibleChronology =
      (openMs !== null && execStartMs !== null && execStartMs < openMs) ||
      (inactiveStatus && statusMs !== null && issueMs !== null && issueMs >= statusMs) ||
      inactiveStatus;

    if (impossibleChronology) {
      triggered_vectors.push("VETOR_2_CRONOLOGIA_CNPJ");
      itemTags.push("[ACT_CHRONOLOGY_OR_INACTIVE_CNPJ_FRAUD_BLOCK]");
      details.push(
        `Vetor 2 (Cronologia/CNPJ): Status cadastral '${statusUpper}' ou execução/emissão anterior à abertura do CNPJ (${item.issuer_opening_date || "N/A"}).`
      );
    }

    // Vetor 3: Rastreabilidade de Emissor Público no PNCP
    const isPublicIssuer = ["PUBLIC", "STATE_ENTERPRISE", "PUBLICO", "ESTATAL"].includes(
      (item.issuer_type || "").toUpperCase()
    );
    if (isPublicIssuer && item.pncp_contract_verified === false) {
      triggered_vectors.push("VETOR_3_PNCP_NAO_LOCALIZADO");
      itemTags.push("[ACT_PUBLIC_CONTRACT_UNVERIFIED_IN_PNCP]");
      details.push(
        `Vetor 3 (PNCP): Emissor público/estatal sem contrato, ARP ou empenho localizável no PNCP (${item.pncp_reference_id || "sem referência"}).`
      );
    }

    // Vetor 4: Conflito Societário QSA, Parentesco e Contato
    const qsaConflict =
      hasCommonQsaPartner(item.issuer_qsa_partners, item.bidder_qsa_partners) ||
      Boolean(item.same_address_or_cep) ||
      Boolean(item.shared_or_free_email_domain);

    if (qsaConflict) {
      triggered_vectors.push("VETOR_4_QSA_E_CONTATO");
      itemTags.push("[ACT_RELATED_PARTY_SELF_ATTESTATION_ALERT]");
      details.push(
        "Vetor 4 (QSA/Contato): Indício de parte relacionada (sócios em comum, mesmo endereço/CEP ou domínio de e-mail cruzado/gratuito)."
      );
    }

    // Vetor 5: Plágio Literal do Edital / Copy-Paste Trap
    const actText = item.act_description_text || "";
    const trText = item.edital_tr_reference_text || "";
    if (actText.length >= 30 && trText.length >= 30) {
      const sim = computeJaccardSimilarity(actText, trText);
      if (sim >= 0.75) {
        triggered_vectors.push("VETOR_5_PLAGIO_EDITAL");
        itemTags.push("[ACT_LITERAL_EDITAL_PLAGIARISM_DETECTED]");
        details.push(
          `Vetor 5 (Plágio Literal): Similaridade textual de ${(sim * 100).toFixed(1)}% entre o texto do ACT e o Termo de Referência atual.`
        );
      }
    }

    // Vetor 6: Plausibilidade Volumétrica Esforço vs. Tempo
    const vol = Number(item.attested_volume || 0);
    const months = Number(item.execution_months || 0);
    const maxCap = Number(item.max_plausible_monthly_capacity || 0);
    if (vol > 0 && months > 0 && maxCap > 0 && vol / months > maxCap) {
      triggered_vectors.push("VETOR_6_VOLUME_PRAZO");
      itemTags.push("[ACT_IMPLAUSIBLE_VOLUME_TIME_RATIO_ALERT]");
      details.push(
        `Vetor 6 (Volume/Prazo): Média mensal atestada (${(vol / months).toFixed(1)}/mês) excede a capacidade operacional plausível (${maxCap}/mês).`
      );
    }

    // Vetor 7: Metadados Forenses de PDF e Assinatura Digital
    const pdfMs = parseDateMs(item.pdf_creation_date);
    const sigMs = parseDateMs(item.digital_signature_date);
    const refMs = sigMs ?? pdfMs;
    if (issueMs !== null && refMs !== null && !item.is_second_copy_declared) {
      const diffDays = Math.abs(refMs - issueMs) / (1000 * 60 * 60 * 24);
      if (diffDays > 30) {
        triggered_vectors.push("VETOR_7_METADADOS_PDF");
        itemTags.push("[ACT_FORENSIC_SIGNATURE_DATE_MISMATCH]");
        details.push(
          `Vetor 7 (Metadados PDF/Assinatura): Divergência de ${Math.round(diffDays)} dias entre a data declarada no ACT (${item.act_issue_date}) e a assinatura/criação do PDF sem ressalva de 2ª via.`
        );
      }
    }

    itemTags.forEach((t) => allTagsSet.add(t));
    totalAlerts += itemTags.length;

    findings.push({
      certificate_id: certId,
      issuer_name: issuerName,
      issuer_cnpj: issuerCnpj,
      triggered_vectors,
      blocking_tags: itemTags,
      details,
    });
  }

  return {
    certificates_audited: items.length,
    total_alerts: totalAlerts,
    blocking_tags: Array.from(allTagsSet),
    items: findings,
  };
}
