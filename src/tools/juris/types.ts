// ============================================================================
// Tipos e Modelos do Domínio de Jurisprudência (docgov-engine v1.4.0)
// ============================================================================

export type JurisStance = "DEFENSE" | "ATTACK" | "BOTH";
export type JurisLegalRegime = "13303" | "14133" | "BOTH";

export interface JurisdictionRoutingInfo {
  executed_courts: string[];
  unimplemented_uf_requested: string | null;
  supported_ufs: string[];
  fallback_notice: string | null;
}

export interface CourtDiagnostic {
  court: string;
  status: "ok" | "error";
  hits: number;
  latency_ms: number;
  error: string | null;
}

export interface StatutoryBridgeMapping {
  id: string;
  topic: string;
  art13303: string;
  art14133: string;
  sumulasTcu: string[];
  keywords: string[];
  distinguishingNote: string;
}

export interface JurisSearchResultItem {
  id: string;
  court: string;
  colegiado?: string;
  numero?: string;
  ano?: number;
  processo?: string;
  relator?: string;
  dataSessao?: string;
  entidade?: string;
  regimeLegal?: "LEI_13303_ESTATAIS" | "LEI_14133_ADM_DIRETA" | "OUTRO";
  indexacao?: string;
  tese?: string;
  tese_short?: string;
  dispositivo?: string;
  outcome?: string;
  relevance_score: number; // 0..100
  score?: number; // alias para relevance_score
  statutory_bridge_refs?: string[];
}

export interface SearchJurisOptions {
  caseDir?: string;
  query?: string;
  queries?: string; // alias para query
  courts?: string[];
  uf?: string;
  stance?: JurisStance;
  regime?: JurisLegalRegime;
  colegiado?: string;
  anoMin?: number;
  limit?: number;
}

export interface SearchJurisSyntheticResult {
  status: "success";
  engine_version: string;
  queries_executed: number;
  stance: JurisStance;
  regime: JurisLegalRegime;
  total_hits: number;
  statutory_bridge_applied: string[];
  jurisdiction_routing: JurisdictionRoutingInfo;
  top_hits: Array<{
    id: string;
    court: string;
    score: number;
    relevance_score: number;
    outcome: string;
    tese_short: string;
  }>;
  results_md: string;
  next_step_hint: string;
}

export interface SearchJurisFileResult {
  engine_version: string;
  timestamp: string;
  query: string;
  queries_executed: string[];
  stance: JurisStance;
  regime: JurisLegalRegime;
  total_hits: number;
  statutory_bridge_applied: string[];
  normative_bridge: string[]; // alias obrigatório para statutory_bridge_applied (.NET Gen4)
  jurisdiction_routing: JurisdictionRoutingInfo;
  court_diagnostics?: CourtDiagnostic[];
  results: JurisSearchResultItem[];
}

// ============================================================================
// Fatiamento Anatômico em 6 Macro-Partes / 10 Sub-Camadas
// ============================================================================

export interface Layer1A_Metadata {
  tribunal: string;
  colegiado: string;
  numero: string;
  ano: number;
  processo?: string;
  relator?: string;
  dataSessao?: string;
}

export interface Layer1B_EntityRegime {
  entidade?: string;
  regimeLegal: "LEI_13303_ESTATAIS" | "LEI_14133_ADM_DIRETA" | "OUTRO";
  isStateItEntity: boolean;
}

export interface Layer6A_ClosingQuorum {
  quorum: string;
  votos?: string;
  data?: string;
}

export interface AnatomicalLayers {
  layer_1A_metadata: Layer1A_Metadata;
  layer_1B_entity_regime: Layer1B_EntityRegime;
  layer_2A_indexing_tags: string[];
  layer_2B_enunciado_tese: string;
  layer_3A_factual_controversy: string;
  layer_3B_defense_arguments: string;
  layer_3C_technical_unit_analysis: string;
  layer_4A_ratio_decidendi: string;
  layer_5A_operative_commands: string[];
  outcome_summary: string;
  layer_6A_closing_quorum: Layer6A_ClosingQuorum;
}

export interface TopicSectionSlice {
  title: string;
  rawText: string;
}

export interface SlicedDossierResult {
  layers: AnatomicalLayers;
  topicsMatched: number;
  matchedSections: TopicSectionSlice[];
  dossieMarkdown: string;
  fullMarkdown: string;
}

export interface FetchJurisOptions {
  caseDir?: string;
  acordaoIdOrUrl?: string;
  id?: string; // alias para acordaoIdOrUrl
  court?: string;
  shortname?: string;
  topicFilter?: string;
  stance?: JurisStance;
}

export interface FetchJurisSyntheticResult {
  status: "success";
  engine_version: string;
  verified_authentic: true;
  canonical_id: string;
  court: string;
  colegiado: string;
  relator: string;
  regime_detected: "LEI_13303_ESTATAIS" | "LEI_14133_ADM_DIRETA" | "OUTRO";
  outcome: string;
  layers_extracted: string[];
  topics_matched: number;
  dossie_sliced_md: string;
  inteiro_teor_full_md: string;
  next_step_hint: string;
}

// ============================================================================
// Provedor de Jurisprudência (Adapter Pattern)
// ============================================================================

export interface RawJurisSearchResult {
  id: string;
  court: string;
  colegiado?: string;
  numero?: string;
  ano?: number;
  processo?: string;
  relator?: string;
  dataSessao?: string;
  entidade?: string;
  indexacao?: string;
  tese?: string;
  dispositivo?: string;
  rawPayload?: any;
}

export interface RawJurisFetchResult {
  id: string;
  court: string;
  exists: boolean;
  rawTextOrJson: any;
}

export type JurisdictionTier = "FEDERAL" | "STATE";

export interface JurisdictionProvider {
  readonly courtId: string;
  readonly tier?: JurisdictionTier;
  readonly uf?: string;
  readonly defaultFederal?: boolean;
  readonly envOverrideKey?: string;
  readonly liveSmokeQuery?: string;
  readonly idPatterns?: RegExp[];
  search(query: string, options?: Partial<SearchJurisOptions>): Promise<RawJurisSearchResult[]>;
  searchWithDiagnostic?(query: string, options?: Partial<SearchJurisOptions>): Promise<{
    hits: RawJurisSearchResult[];
    diagnostic: CourtDiagnostic;
  }>;
  fetch(idOrRef: string): Promise<RawJurisFetchResult | null>;
}
