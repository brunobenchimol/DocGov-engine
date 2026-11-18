// ============================================================================
// Barrel File: Obras e Serviços de Engenharia (Geração 6.5 — Eixo 2)
// docgov-engine v1.6.6 — src/engineering/index.ts
// ============================================================================

export * from "./types.ts";
export {
  ACORDAO_2622_BDI_QUARTILES,
  calculateOfficialTcu2622BdiBps,
  evaluateBdiAcordao2622,
} from "./bdi_acordao_2622_evaluator.ts";
export {
  getExpectedLei14973TransitionBps,
  evaluateSinapiSicroAndSchedule,
} from "./sinapi_sicro_schedule_evaluator.ts";
export {
  buildEngineeringAuditMarkdown,
  compileEngineeringPericialDocxAndPdf,
} from "./docx_renderer.ts";
export { normalizeEngineeringWorksInput } from "./input_normalizer.ts";
export { ENGINEERING_WORKS_TOOL_DEFINITION } from "./tool_definition.ts";
export {
  auditEngineeringWorks,
  serializeEngineeringWorksSyntheticResult,
} from "./engineering_works_auditor.ts";
