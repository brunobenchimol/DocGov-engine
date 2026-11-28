// ============================================================================
// Definição MCP Completa (inputSchema com Subcampos): Tool 16 Obras (v1.6.7)
// docgov-engine — src/engineering/tool_definition.ts
// ============================================================================

export const ENGINEERING_WORKS_TOOL_DEFINITION = {
  name: "docgov_audit_engineering_works",
  description:
    "Auditoria de obras/engenharia: BDI (Ac. TCU 2.622/2013), Curva ABC SINAPI/SICRO, CPRB, front-loading, Matriz de Riscos e inexequibilidade 75%/85%.\n" +
    "- Quando usar: Auditar orçamentos, BDI e cronogramas de engenharia.\n" +
    "- Próximo Passo: Use inline_markdown ou read_file; <=8KB/<=880B.",
  inputSchema: {
    type: "object",
    properties: {
      engineeringJsonPath: {
        type: "string",
        description: "Caminho do JSON de engenharia.",
      },
      inputPath: {
        type: "string",
        description: "Alias ou JSON inline.",
      },
      workspaceDir: {
        type: "string",
        description: "Diretório de saída.",
      },
      workspace_dir: {
        type: "string",
        description: "Alias para workspaceDir.",
      },
      case_id: {
        type: "string",
        description: "ID do caso ou processo.",
      },
      contract_regime: {
        type: "string",
        enum: ["LEI_14133", "LEI_13303"],
        description: "Regime jurídico contratual.",
      },
      work_typology: {
        type: "string",
        enum: [
          "CONSTRUCAO_EDIFICIOS",
          "RODOVIARIA",
          "REDES_AGUA_ESGOTO",
          "REDES_ENERGIA_ELETRICA",
          "PORTUARIA_MARITIMA",
          "FORNECIMENTO_MATERIAIS_EQUIPAMENTOS",
        ],
        description: "Tipologia da obra (Ac. 2.622/2013).",
      },
      execution_regime: {
        type: "string",
        enum: [
          "EMPREITADA_PRECO_UNITARIO",
          "EMPREITADA_PRECO_GLOBAL",
          "EMPREITADA_INTEGRAL",
          "TAREFA",
          "CONTRATACAO_INTEGRADA",
          "CONTRATACAO_SEMI_INTEGRADA",
        ],
        description: "Regime de execução da obra.",
      },
      estimated_budget_cents: {
        type: "number",
        description: "Orçamento estimado (centavos).",
      },
      offered_proposal_cents: {
        type: "number",
        description: "Proposta ofertada (centavos).",
      },
      additional_guarantee_offered: {
        type: "boolean",
        description: "Garantia adicional (<85%, Art. 59 §5º).",
      },
      summary_disqualification_attempted: {
        type: "boolean",
        description: "Desclassificação sumária s/ diligência.",
      },
      prior_diligence_opportunity_granted: {
        type: "boolean",
        description: "Diligência prévia concedida.",
      },
      diligence_viability_proven: {
        type: "boolean",
        description: "Exequibilidade provada na diligência.",
      },
      has_unit_price_overpricing: {
        type: "boolean",
        description: "Sobrepreço unitário / Jogo de Planilha.",
      },
      bdi_evaluation: {
        type: "object",
        description: "BDI e rubricas (valores *_bps em basis points: 1% = 100 bps).",
        properties: {
          central_admin_bps: { type: "number" },
          central_admin_pct: { type: "number" },
          insurance_and_guarantee_bps: { type: "number" },
          risk_bps: { type: "number" },
          financial_expenses_bps: { type: "number" },
          profit_bps: { type: "number" },
          pis_bps: { type: "number" },
          cofins_bps: { type: "number" },
          iss_bps: { type: "number" },
          cprb_bps: { type: "number" },
          irpj_bps: { type: "number", description: "IRPJ no BDI (Súmula 254)." },
          csll_bps: { type: "number", description: "CSLL no BDI (Súmula 254)." },
          declared_bdi_bps: { type: "number" },
          declared_bdi_pct: { type: "number" },
          justification_above_q3_proven: { type: "boolean", description: "Justificativa BDI > Q3 aprovada." },
          includes_admin_local_in_bdi: { type: "boolean" },
          includes_canteiro_or_mobilizacao_in_bdi: { type: "boolean" },
          includes_irpj_or_csll: { type: "boolean" },
          has_relevant_equipment_supply: { type: "boolean" },
          relevant_equipment_share_bps: { type: "number" },
          differentiated_equipment_bdi_bps: { type: "number", description: "BDI equip. (Súmula 253, bps)." },
          admin_local_proportional_to_physical_progress: { type: "boolean" },
          physical_progress_bps: { type: "number" },
          admin_local_measured_bps: { type: "number" },
        },
      },
      tax_desoneracao_cprb: {
        type: "object",
        description: "Simetria CPRB Lei 14.973/2024 (*_bps em basis points).",
        properties: {
          reference_year: { type: "number", description: "Ano transição Lei 14.973 (2024..2028)." },
          sinapi_sicro_table_regime: { type: "string", enum: ["DESONERADO", "NAO_DESONERADO"], description: "Regime SINAPI/SICRO adotado." },
          bdi_includes_cprb: { type: "boolean" },
          applied_cprb_bps: { type: "number" },
          payroll_inss_bps: { type: "number" },
        },
      },
      curva_abc_items: {
        type: "array",
        description: "Curva ABC SINAPI/SICRO (valores *_cents em centavos).",
        items: {
          type: "object",
          properties: {
            item_id: { type: "string", description: "Código SINAPI/SICRO ou ID." },
            description: { type: "string" },
            reference_source: { type: "string", enum: ["SINAPI", "SICRO", "COTACAO_MERCADO"], description: "Base referencial do item." },
            quantity: { type: "number" },
            sinapi_sicro_median_unit_cents: { type: "number" },
            offered_unit_cents: { type: "number" },
            specificity_justification_approved: { type: "boolean", description: "Nota técnica aprovada p/ acima mediana." },
          },
        },
      },
      unit_price_items: {
        type: "array",
        description: "Preços unitários em BRL (reais) para Jogo de Planilha.",
        items: {
          type: "object",
          properties: {
            item_id: { type: "string" },
            estimated_unit_price: { type: "number" },
            offered_unit_price: { type: "number" },
          },
        },
      },
      schedule_and_risk: {
        type: "object",
        description: "Cronograma (descompasso > 5% = 500 bps) e Matriz de Riscos.",
        properties: {
          front_loading_detected: { type: "boolean" },
          schedule_stages: {
            type: "array",
            description: "Etapas acumuladas (descompasso > 500 bps).",
            items: {
              type: "object",
              properties: {
                stage_number: { type: "number" },
                description: { type: "string" },
                reference_physical_cumulative_bps: { type: "number" },
                reference_physical_cumulative_pct: { type: "number" },
                financial_disbursement_cumulative_bps: { type: "number" },
                financial_disbursement_cumulative_pct: { type: "number" },
              },
            },
          },
          has_risk_allocation_matrix: { type: "boolean", description: "Matriz de Riscos (Integrada/Semi)." },
          has_anteprojeto_or_basic_design: { type: "boolean" },
          attempts_design_error_addendum_without_legal_exception: { type: "boolean", description: "Aditivo erro projeto s/ exceção Art.46§8º." },
        },
      },
      outputFormat: {
        type: "string",
        enum: ["docx", "pdf", "both"],
        description: "Formato do laudo (padrão: both).",
      },
    },
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
  },
};
