// ============================================================================
// Definição MCP Completa (inputSchema com Subcampos): Tool 16 Obras (v1.6.7)
// docgov-engine — src/engineering/tool_definition.ts
// ============================================================================

export const ENGINEERING_WORKS_TOOL_DEFINITION = {
  name: "docgov_audit_engineering_works",
  description:
    "Auditoria matemática de obras/engenharia: BDI (Acórdão TCU 2.622/2013, Súmulas 253/254, Adm. Local), Curva ABC SINAPI/SICRO (Decreto 7.983/2013), simetria CPRB (Lei 14.973/2024), front-loading, Matriz de Riscos (Integrada/Semi-Integrada) e inexequibilidade 75%/85% + Jogo de Planilha (aceita aninhado/flat).\n" +
    "- Quando usar: Para auditar orçamentos, BDI, cronogramas e propostas de obras/engenharia.\n" +
    "- Próximo Passo: Inspecione engineering_works_audit.json/.md e laudo_pericial_obras_engenharia.docx/.pdf. Retorno <= 880B.",
  inputSchema: {
    type: "object",
    properties: {
      engineeringJsonPath: {
        type: "string",
        description: "Caminho do arquivo JSON contendo os dados da planilha de engenharia, BDI, SINAPI/SICRO e cronograma.",
      },
      inputPath: {
        type: "string",
        description: "Alias para engineeringJsonPath ou string JSON inline.",
      },
      workspaceDir: {
        type: "string",
        description: "Diretório de saída onde os artefatos JSON, MD, DOCX e PDF serão gravados.",
      },
      workspace_dir: {
        type: "string",
        description: "Alias canônico de workspaceDir para persistência dos artefatos.",
      },
      case_id: {
        type: "string",
        description: "Identificador do processo ou caso administrativo auditado.",
      },
      contract_regime: {
        type: "string",
        enum: ["LEI_14133", "LEI_13303"],
        description: "Regime jurídico regente do contrato (LEI_14133 ou LEI_13303).",
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
        description: "Tipologia oficial da obra segundo o Acórdão TCU nº 2.622/2013-Plenário.",
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
        description: "Regime de execução contratual da obra ou serviço de engenharia.",
      },
      estimated_budget_cents: {
        type: "number",
        description: "Valor global estimado pela Administração em centavos inteiros.",
      },
      offered_proposal_cents: {
        type: "number",
        description: "Valor global da proposta licitante em centavos inteiros.",
      },
      additional_guarantee_offered: {
        type: "boolean",
        description: "Indica prestação de garantia adicional exigida abaixo de 85% (Art. 59 § 5º).",
      },
      summary_disqualification_attempted: {
        type: "boolean",
        description: "Indica tentativa de desclassificação sumária sem diligência prévia (Súmula TCU 262).",
      },
      prior_diligence_opportunity_granted: {
        type: "boolean",
        description: "Indica se foi aberta diligência contraditória prévia ao licitante.",
      },
      diligence_viability_proven: {
        type: "boolean",
        description: "Indica se a exequibilidade foi demonstrada em diligência.",
      },
      has_unit_price_overpricing: {
        type: "boolean",
        description: "Sinaliza sobrepreço unitário / Jogo de Planilha diretamente na raiz.",
      },
      bdi_evaluation: {
        type: "object",
        description: "Composição algébrica do BDI, BDI Diferenciado (Súmula 253), IRPJ/CSLL e Administração Local.",
        properties: {
          central_admin_bps: { type: "number", description: "Administração central (bps, ex.: 400 = 4%)." },
          central_admin_pct: { type: "number", description: "Alias percentual para central_admin_bps." },
          insurance_and_guarantee_bps: { type: "number", description: "Seguro e garantia (bps)." },
          risk_bps: { type: "number", description: "Taxa de risco (bps)." },
          financial_expenses_bps: { type: "number", description: "Despesas financeiras (bps)." },
          profit_bps: { type: "number", description: "Lucro (bps)." },
          pis_bps: { type: "number", description: "Alíquota PIS (bps)." },
          cofins_bps: { type: "number", description: "Alíquota COFINS (bps)." },
          iss_bps: { type: "number", description: "Alíquota ISS (bps)." },
          cprb_bps: { type: "number", description: "Alíquota CPRB no BDI (bps)." },
          irpj_bps: { type: "number", description: "IRPJ indevidamente cotado no BDI (bps — Súmula 254)." },
          csll_bps: { type: "number", description: "CSLL indevidamente cotada no BDI (bps — Súmula 254)." },
          declared_bdi_bps: { type: "number", description: "BDI total declarado (bps, ex.: 2359 = 23,59%)." },
          declared_bdi_pct: { type: "number", description: "Alias percentual para declared_bdi_bps." },
          justification_above_q3_proven: { type: "boolean", description: "Justificativa técnica aprovada para BDI > 3º Quartil." },
          includes_admin_local_in_bdi: { type: "boolean", description: "Indica Administração Local dentro do BDI (bis in idem)." },
          includes_canteiro_or_mobilizacao_in_bdi: { type: "boolean", description: "Indica Canteiro/Mobilização dentro do BDI (bis in idem)." },
          includes_irpj_or_csll: { type: "boolean", description: "Indica inclusão de IRPJ/CSLL no BDI ou planilha." },
          has_relevant_equipment_supply: { type: "boolean", description: "Indica fornecimento relevante de materiais/equipamentos." },
          relevant_equipment_share_bps: { type: "number", description: "Participação dos equipamentos no orçamento (bps)." },
          differentiated_equipment_bdi_bps: { type: "number", description: "BDI Diferenciado aplicado a equipamentos (bps — Súmula 253)." },
          admin_local_proportional_to_physical_progress: { type: "boolean", description: "Indica se a Administração Local é medida proporcionalmente ao avanço físico." },
          physical_progress_bps: { type: "number", description: "Avanço físico acumulado da obra (bps)." },
          admin_local_measured_bps: { type: "number", description: "Percentual medido de Administração Local (bps)." },
        },
      },
      tax_desoneracao_cprb: {
        type: "object",
        description: "Parâmetros de simetria Com/Sem Desoneração CPRB (Lei nº 14.973/2024).",
        properties: {
          reference_year: { type: "number", description: "Ano-calendário de referência da transição Lei 14.973/2024 (2024..2028)." },
          sinapi_sicro_table_regime: { type: "string", enum: ["DESONERADO", "NAO_DESONERADO"], description: "Regime da tabela SINAPI/SICRO adotada." },
          bdi_includes_cprb: { type: "boolean", description: "Indica se o BDI inclui parcela de CPRB." },
          applied_cprb_bps: { type: "number", description: "Alíquota de CPRB aplicada (bps)." },
          payroll_inss_bps: { type: "number", description: "Alíquota de INSS sobre folha adotada na planilha (bps)." },
        },
      },
      curva_abc_items: {
        type: "array",
        description: "Itens da Curva ABC confrontados com medianas SINAPI/SICRO (Decreto nº 7.983/2013).",
        items: {
          type: "object",
          properties: {
            item_id: { type: "string", description: "Código SINAPI/SICRO ou identificador do item." },
            description: { type: "string", description: "Descrição do insumo ou serviço." },
            reference_source: { type: "string", enum: ["SINAPI", "SICRO", "COTACAO_MERCADO"], description: "Base referencial do item." },
            quantity: { type: "number", description: "Quantidade orçada do item." },
            sinapi_sicro_median_unit_cents: { type: "number", description: "Preço unitário mediano SINAPI/SICRO em centavos." },
            offered_unit_cents: { type: "number", description: "Preço unitário ofertado em centavos." },
            specificity_justification_approved: { type: "boolean", description: "Nota técnica aprovada justificando preço acima da mediana." },
          },
        },
      },
      unit_price_items: {
        type: "array",
        description: "Lista opcional adicional de preços unitários para avaliação de Jogo de Planilha.",
        items: {
          type: "object",
          properties: {
            item_id: { type: "string", description: "Identificador do item." },
            estimated_unit_price: { type: "number", description: "Preço unitário referencial em reais." },
            offered_unit_price: { type: "number", description: "Preço unitário ofertado em reais." },
          },
        },
      },
      schedule_and_risk: {
        type: "object",
        description: "Cronograma físico-financeiro (front-loading) e Matriz de Riscos (Contratação Integrada/Semi-Integrada).",
        properties: {
          front_loading_detected: { type: "boolean", description: "Sinaliza antecipação artificial de desembolso (front-loading)." },
          schedule_stages: {
            type: "array",
            description: "Etapas acumuladas do cronograma físico-financeiro para detecção de descompasso > 5% (500 bps).",
            items: {
              type: "object",
              properties: {
                stage_number: { type: "number", description: "Número da etapa/medição." },
                description: { type: "string", description: "Descrição da etapa." },
                reference_physical_cumulative_bps: { type: "number", description: "Avanço físico acumulado referencial (bps)." },
                reference_physical_cumulative_pct: { type: "number", description: "Alias percentual do avanço físico acumulado." },
                financial_disbursement_cumulative_bps: { type: "number", description: "Desembolso financeiro acumulado proposto (bps)." },
                financial_disbursement_cumulative_pct: { type: "number", description: "Alias percentual do desembolso financeiro acumulado." },
              },
            },
          },
          has_risk_allocation_matrix: { type: "boolean", description: "Indica presença de Matriz de Alocação de Riscos (obrigatória em Integrada/Semi-Integrada)." },
          has_anteprojeto_or_basic_design: { type: "boolean", description: "Indica presença de anteprojeto ou projeto básico." },
          attempts_design_error_addendum_without_legal_exception: { type: "boolean", description: "Indica pleito de aditivo por erro/omissão de projeto sem exceção legal (Art. 46 § 8º)." },
        },
      },
      outputFormat: {
        type: "string",
        enum: ["docx", "pdf", "both"],
        description: "Formato de emissão do laudo pericial (padrão: both).",
      },
    },
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
  },
};
