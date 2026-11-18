// ============================================================================
// Barrel File: Auditoria do Regime DEMO (Geração 6.5 — Eixo 1)
// docgov-engine v1.6.5 — src/demo_costs/index.ts
// ============================================================================

export * from "./types.ts";
export {
  ANEXO_VIB_PRODUCTIVITY_BOUNDS,
  calculateDemoCostSheet,
} from "./sheet_calculator.ts";
export { evaluateDemoExecutionGovernance } from "./execution_governance.ts";
export {
  buildDemoAuditMarkdown,
  compileDemoPericialDocxAndPdf,
} from "./docx_renderer.ts";
export {
  DEMO_REGIME_TOOL_DEFINITION,
  auditDemoRegime,
  serializeDemoRegimeSyntheticResult,
} from "./audit_runner.ts";
