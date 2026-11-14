// ============================================================================
// Barrel File: Contratação Direta & Oportunidade Estatal (Gen6)
// docgov-engine v1.6.0 — src/direct_contracting/index.ts
// ============================================================================

export * from "./types.ts";
export {
  normalizeDirectModality,
  evaluateDirectContractingRules,
} from "./direct_contracting_auditor.ts";
export { compileDirectContractingOpinion } from "./direct_contracting_compiler.ts";
export {
  auditDirectContracting,
  serializeDirectContractingSyntheticResult,
} from "./audit_direct_contracting.ts";
