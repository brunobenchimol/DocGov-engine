// ============================================================================
// Definições de Ferramentas e Prompts MCP (docgov-engine v1.7.5)
// ============================================================================

import { DEMO_REGIME_TOOL_DEFINITION } from "../demo_costs/audit_runner.ts";
import { ENGINEERING_WORKS_TOOL_DEFINITION } from "../engineering/engineering_works_auditor.ts";

export function getMcpPromptsDefinition() {
  return [
    {
      name: "docx_workflow_guide",
      description:
        "Guia canônico e manual de arquitetura do docgov-engine: ordem do pipeline (1..5), sintaxe de tags, estrutura do slots_manifest.json e boas práticas de injeção.",
      arguments: [],
    },
  ];
}

export function getMcpToolsDefinition() {
  return [
    {
      name: "bootstrap_case",
      description:
        "Inicializa a árvore do caso (inputs/, state/, templates/, output/, assets/), descompacta pacotes (.zip/.tar/.tgz), auto-batiza anexos opacos (media_*) ou aplica fileRenameMap, inspeciona .docx/.pdf/.xlsx/.csv (com OCR e auditoria orçamentária) e gera state/indice_mestre_caso.md.\n" +
        "- Quando usar: 1º passo obrigatório em todo caso DocGov (restrito a cases/<slug>/).\n" +
        "- Próximo Passo: Leia indice_mestre_caso.md, visao_auditoria_*.md ou dossie_hotspots_*.md, ou chame inspect_doc / build_docx_template.",
      inputSchema: {
        type: "object",
        required: ["caseDir"],
        properties: {
          caseDir: {
            type: "string",
            description:
              "Caminho absoluto ou relativo da pasta raiz do caso (ex.: 'cases/caso_exemplo').",
          },
          uploadsDir: {
            type: "string",
            description:
              "Caminho opcional da pasta contendo os uploads originais do usuário.",
          },
          fileRenameMap: {
            type: "object",
            description:
              "Mapeamento explícito opcional de nomes de arquivos originais para nomes canônicos.",
            additionalProperties: { type: "string" },
          },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "inspect_doc",
      description:
        "Engenharia reversa de .docx, .pdf (OCR), .xlsx, .csv e .md/.txt (rejeita .zip/.tar). Gera toc_map, Z1..Z14, auditoria orçamentária, structure_fingerprint, cache matching (created_at/Auto-Offset), visao_auditoria_<nome>.md, dossie_hotspots_<nome>.md e toc_summary bimodal (<=8KB/<=1KB).\n" +
        "- Quando usar: Após bootstrap_case para inspecionar documento individual ou diff (fora de cases/<slug>/, isola em %TEMP%).\n" +
        "- Próximo Passo: Em EXACT/MODIFIED, chame build_docx_template; em NEW/PDF, leia o dossiê ou a visão.",
      inputSchema: {
        type: "object",
        required: ["filePath"],
        properties: {
          filePath: { type: "string", description: "Caminho do arquivo a ser inspecionado." },
          docxPath: { type: "string", description: "Alias retrocompatível para filePath." },
          outputPath: { type: "string", description: "Caminho onde o mapa JSON será gravado." },
          compact: { type: "boolean", description: "Se true, omite parágrafos e células vazias." },
          compareWithPath: { type: "string", description: "Caminho opcional de um documento base/anterior para Diff Estrutural." },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "build_docx_template",
      description:
        "Parametriza .docx bruto em template {{...}} via slots_manifest.json (coordenadas compactas ou canônicas, remove_table_rows) com auto-reparo de JSON, preservação visual, Heading Guard, validação fail-fast Exact Copy-Paste Error (Zero Silent No-Op) e saveToRegistry opcional.\n" +
        "- Quando usar: Após inspect_doc e criação/adaptação do slots_manifest.json (restrito a cases/<slug>/).\n" +
        "- Próximo Passo: Preencha estado_caso.json e chame fill_docx_template.",
      inputSchema: {
        type: "object",
        required: ["sourcePath", "manifestPath", "outputPath"],
        properties: {
          sourcePath: { type: "string", description: "Caminho do Word (.docx) bruto original." },
          manifestPath: {
            type: "string",
            description:
              "Caminho do arquivo JSON de manifesto contendo as regras de slots (ex.: 'state/slots_manifest.json' ou 'state/adapted_slots_manifest_<stem>.json'). Suporta notação compacta com { slots: [{ coord: 'T0.R1.C1', tag: '...' }, { coord: 'P2', tag: '...' }] } ou arrays canônicos como replace_paragraphs, replace_table_cells, loop_table_rows e replace_inline. Validação estrita: proíbe propriedades inventadas.",
          },
          outputPath: { type: "string", description: "Caminho do novo template .docx parametrizado." },
          saveToRegistry: { type: "boolean", description: "Se true, salva no cache global." },
          templateId: { type: "string", description: "Identificador único opcional no registro global." },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "fill_docx_template",
      description:
        "Injeta estado_caso.json (com auto-reparo JSON e unflatten de chaves com ponto) em template .docx, resolvendo variáveis, FOR/IF, tabelas Markdown para <w:tbl>, listas multinível (word/numbering.xml / hanging indent) e saída DOCX/PDF.\n" +
        "- Quando usar: Após build_docx_template e elaboração do estado_caso.json (restrito a cases/<slug>/).\n" +
        "- Próximo Passo: Gera minuta final e auto-inspeciona em state/visao_auditoria_<stem>.md (pronto para auditoria, sem reexecutar inspect_doc).",
      inputSchema: {
        type: "object",
        required: ["templatePath", "statePath", "outputPath"],
        properties: {
          templatePath: { type: "string", description: "Caminho do template Word (.docx)." },
          statePath: { type: "string", description: "Caminho do JSON contendo os dados do caso." },
          outputPath: { type: "string", description: "Caminho de saída da minuta final." },
          autoInspect: { type: "boolean", description: "Executa auto-inspeção gerando visao_auditoria. Padrão: true." },
          outputFormat: { type: "string", enum: ["docx", "pdf", "both"], description: "Formato de saída: docx, pdf ou both." },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "generate_audit_docx",
      description:
        "Compila Relatório de Auditoria, Matriz de Riscos (Lei 14.133/2021), Checklist (TCU/AGU/MGI) ou Peça de Impugnação (Modo ATTACK) em DOCX/PDF A4 vertical (zero tabelas), com validação fail-fast Exact Copy-Paste Error e citações probatórias.\n" +
        "- Quando usar: Após consolidar relatorio_auditoria.json ou peca_impugnacao.json (restrito a cases/<slug>/).\n" +
        "- Próximo Passo: Gera o parecer/peça executiva em outputPath e conclui o ciclo de auditoria.",
      inputSchema: {
        type: "object",
        required: ["auditJsonPath", "outputPath"],
        properties: {
          auditJsonPath: { type: "string", description: "Caminho do arquivo relatorio_auditoria.json ou peca_impugnacao.json." },
          outputPath: { type: "string", description: "Caminho onde o arquivo do parecer/peça será salvo." },
          outputFormat: { type: "string", enum: ["docx", "pdf", "both"], description: "Formato de saída: docx, pdf ou both." },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "generate_technical_note_docx",
      description:
        "Compila Nota Técnica Comparativa ('Antes vs. Depois') ou de Contrarrazões Jurídicas (Modo DEFENSE) em DOCX/PDF A4 vertical (cards coloridos e diff granular inline), via noteJsonPath e/ou comparação direta entre oldPath e newPath.\n" +
        "- Quando usar: Após revisões substantivas em TR/ETP/Edital para justificar alterações ao controle (restrito a cases/<slug>/).\n" +
        "- Próximo Passo: Gera a Nota Técnica executiva em outputPath (.docx/.pdf) concluindo a governança de alterações.",
      inputSchema: {
        type: "object",
        required: ["outputPath"],
        properties: {
          outputPath: { type: "string", description: "Caminho onde a nota técnica será gerada." },
          noteJsonPath: { type: "string", description: "Caminho do JSON com evolução ou contrarrazões." },
          oldPath: { type: "string", description: "Caminho do documento base para diff automático." },
          newPath: { type: "string", description: "Caminho do documento revisado para diff automático." },
          outputFormat: { type: "string", enum: ["docx", "pdf", "both"], description: "Formato: docx, pdf ou both." },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "fetch_pncp",
      description:
        "Baixa metadados e anexos públicos de uma contratação no PNCP (número de controle, URL, tupla ou link Google Grounding), isolando em inputs/pncp_<shortname>/ com descompactação automática e catalogação para pesquisa de mercado (IN 65/2021).\n" +
        "- Quando usar: Quando já possuir o identificador/URL PNCP para benchmarking (restrito a cases/<slug>/).\n" +
        "- Próximo Passo: Consulte state/indice_pncp_<shortname>.md e state/pncp_<shortname>_meta.json para leitura seletiva.",
      inputSchema: {
        type: "object",
        required: ["caseDir", "pncpIdOrUrl"],
        properties: {
          caseDir: { type: "string", description: "Diretório do caso de trabalho." },
          pncpIdOrUrl: { type: "string", description: "Identificador oficial do PNCP ou URL." },
          shortname: { type: "string", description: "Apelido curto opcional para a subpasta." },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "search_pncp",
      description:
        "Busca textual multi-query (separada por '|') no endpoint /api/search/ do PNCP para localizar editais e contratações de referência (IN 65/2021), desduplicando e acumulando resultados da sessão (fora de cases/<slug>/, isola em %TEMP%).\n" +
        "- Quando usar: Para descobrir contratações similares por objeto, órgão, UF ou modalidade.\n" +
        "- Próximo Passo: Inspecione state/pncp_search_results.md, escolha o pncp_id aderente e chame fetch_pncp.",
      inputSchema: {
        type: "object",
        required: ["caseDir", "query"],
        properties: {
          caseDir: { type: "string", description: "Diretório do caso de trabalho." },
          query: { type: "string", description: "Termos de busca textual (aceita pipe '|')." },
          status: { type: "string", enum: ["todas", "recebendo_proposta", "encerradas"], description: "Filtro de situação." },
          uf: { type: "string", description: "Filtro de UF." },
          modalidade: { type: "string", description: "Filtro de modalidade." },
          limit: { type: "number", description: "Quantidade máxima de resultados." },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "search_juris",
      description:
        "Busca multi-query de jurisprudência (TCU, STJ, STF, TST, AGU, TCE/TCDF/TCM) com acumulação/lock em state/, defaults neutros (NEUTRAL/AUTO), Statutory Bridge condicional, cache global TTL 24h Live-First e triagem A/B TST (triaged|raw|compare). Retorno bimodal <=8KB/<=1KB.\n" +
        "- Quando usar: Pesquisa jurídica neutra ou tática (DEFENSE/ATTACK) em consultas livres ou licitatórias.\n" +
        "- Próximo Passo: Leia state/juris_search_results.md e chame fetch_juris nos precedentes escolhidos.",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: {
            type: "string",
            description:
              "Expressão de pesquisa textual ou múltiplas queries separadas por '|' executadas em paralelo (ex.: 'lote único indivisibilidade | adjudicação global TI').",
          },
          caseDir: {
            type: "string",
            description:
              "Caminho do caso (ex.: 'cases/meu_caso'). Se omitido ou externo a cases/, grava na pasta efêmera segura (%TEMP%/docgov_ephemeral_inspect/).",
          },
          courts: {
            type: "array",
            items: { type: "string" },
            description:
              "Lista opcional de cortes a consultar (ex.: ['TCU', 'STJ', 'STF', 'TST', 'AGU', 'TCE-PA', 'TCM-PA', 'TCE-CE', 'TCDF', 'TCE-SP', 'TCE-MG', 'TCE-PR']). Se omitido e uf omitida, pesquisa a camada federal (TCU, STJ, STF).",
          },
          uf: {
            type: "string",
            description:
              "Sigla da UF de interesse (ex.: 'PA', 'CE', 'DF', 'SP', 'MG', 'PR') ou código explícito de corte subnacional (ex.: 'TCM-PA'). Se for informada UF não implementada (ex.: 'AM'), ativa Graceful Fallback sem falhar.",
          },
          sphere: {
            type: "string",
            enum: ["STATE", "MUNICIPAL", "ALL"],
            description:
              "Esfera de corte de contas subnacional quando informada UF com múltiplos tribunais (ex.: 'PA' -> TCE-PA e TCM-PA). Padrão 'STATE' (retrocompatível); use 'MUNICIPAL' para TCM ou 'ALL' para ambos.",
          },
          stance: {
            type: "string",
            enum: ["NEUTRAL", "DEFENSE", "ATTACK", "BOTH"],
            description:
              "Postura da pesquisa: 'NEUTRAL' (padrão sem viés ou penalidade tática), 'DEFENSE' (prioriza improcedência e manutenção do certame), 'ATTACK' (prioriza anulação/cautelar) ou 'BOTH'.",
          },
          regime: {
            type: "string",
            enum: ["AUTO", "13303", "14133", "BOTH"],
            description:
              "Regime jurídico: 'AUTO' (padrão; aplica Statutory Bridge apenas com evidência temática na query), '13303' (Lei das Estatais), '14133' (Nova Lei de Licitações) ou 'BOTH'.",
          },
          colegiado: {
            type: "string",
            description:
              "Filtro opcional de colegiado (ex.: 'Plenário', '1ª Câmara', '2ª Câmara').",
          },
          limit: {
            type: "number",
            description:
              "Número máximo de precedentes retornados no ranking (padrão: 10).",
          },
          force_live: {
            type: "boolean",
            description:
              "Se true, ignora circuit breaker e fallback em cache TTL 24h, concedendo janela estendida única (9s, retries: 0) para consulta ao vivo e falhando explicitamente se indisponível.",
          },
          triage_mode: {
            type: "string",
            enum: ["triaged", "raw", "compare"],
            description:
              "Modo A/B exclusivo do conector TST: 'triaged' (padrão TST, 4 baldes), 'raw' (legado v1.7.1) ou 'compare' (4 baldes + raw_diff em 1 única consulta). Ignorado nos demais 11 conectores.",
          },
        },
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "fetch_juris",
      description:
        "Trava anti-alucinação e fatiador anatômico de acórdãos em 6 Macro-Partes (1->6 com corte limpo), autenticando na fonte oficial (cache global TTL 24h) e gravando dossie_juris_<shortname>.md e inteiro_teor_anatomico.md. Retorno bimodal <=8KB/<=1KB.\n" +
        "- Quando usar: Após search_juris para autenticar e fatiar julgado antes de citá-lo.\n" +
        "- Próximo Passo: Leia o dossiê fatiado em state/ com links diretos ao inteiro teor.",
      inputSchema: {
        type: "object",
        required: ["acordaoIdOrUrl"],
        properties: {
          acordaoIdOrUrl: {
            type: "string",
            description:
              "Número/identificador do acórdão (ex.: 'Acórdão 1234/2024-TCU-Plenário' ou '1234/2024') ou URL oficial do tribunal.",
          },
          caseDir: {
            type: "string",
            description:
              "Caminho do caso (ex.: 'cases/meu_caso'). Se omitido ou externo a cases/, grava na pasta efêmera segura (%TEMP%/docgov_ephemeral_inspect/).",
          },
          shortname: {
            type: "string",
            description:
              "Nome curto opcional para o arquivo de dossiê e subpasta em state/juris_<shortname>/ (ex.: 'acordao_lote_unico').",
          },
          topicFilter: {
            type: "string",
            description:
              "Termos de tópico para filtragem cirúrgica do Dossiê do Estágio 2 (ex.: 'lote único | indivisibilidade').",
          },
          stance: {
            type: "string",
            enum: ["NEUTRAL", "DEFENSE", "ATTACK", "BOTH"],
            description:
              "Postura opcional para enquadramento da ratio decidendi (padrão 'NEUTRAL').",
          },
          force_live: {
            type: "boolean",
            description:
              "Se true, ignora fallback em cache TTL 24h e circuit breaker, tentando captura ao vivo com janela estendida única (9s, retries: 0).",
          },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "docgov_audit_contract_execution",
      description:
        "Auditoria determinística de execução contratual: limites de aditivos (25%/50%), batimento quadripartite (bloqueio aditivo em ARP), reajustes (12m), PAS (dosimetria LINDB Art. 22, adequação federativa, glosa ANS vs. multa, seguro-garantia), cesta de preços (IN 65/2021) e álea extraordinária (contrato JSON em --dump-spec).\n" +
        "- Quando usar: Para fiscalizar aditivos, sobrepreço, reajustes, PAS, cesta de preços ou reequilíbrio.\n" +
        "- Próximo Passo: Consulte inline_markdown (em INLINE) ou leia relatorio/dossiê via read_file (em POINTER). Retorno <=8KB/<=880B.",
      inputSchema: {
        type: "object",
        properties: {
          contractJsonPath: {
            type: "string",
            description: "Caminho para o JSON de dados contratuais, histórico de aditivos/faturamento, PAS/ANS-IMR, cesta de preços e pleitos de reequilíbrio.",
          },
          caseDir: {
            type: "string",
            description: "Diretório do caso DocGov (ex.: 'cases/meu_caso').",
          },
          outputDir: {
            type: "string",
            description: "Diretório de saída para os relatórios detalhados e artefatos compilados.",
          },
          auditType: {
            type: "string",
            enum: ["FULL", "ADDENDUM_LIMITS", "TRIPARTITE_MATCH", "READJUSTMENT", "PAS_SANCTIONS", "PRICE_BASKET"],
            description: "Foco ou tipo da auditoria contratual/sancionatória/estatística (padrão: FULL).",
          },
          compilationMode: {
            type: "string",
            enum: ["NONE", "PAS_NOTIFICATION", "SANCTION_DOSIMETRY_OPINION", "DOSIMETRY_OPINION", "BOTH"],
            description: "Modo opcional de compilação documental OpenXML para Notificação Prévia de PAS e/ou Parecer de Dosimetria/Glosa ANS (padrão: NONE).",
          },
          outputFormat: {
            type: "string",
            enum: ["docx", "pdf", "both"],
            description: "Formato de saída dos documentos compilados quando compilationMode != NONE (padrão: both).",
          },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "docgov_govern_arp",
      description:
        "Governança determinística de ARP e adesões (caronas): livro-razão 50% individual / 200% global, compatibilidade federativa/jurídica, travas TIC, vigência (12+12m) e compilação DOCX/PDF de notas de adesão e estudos de vantajosidade (contrato JSON em --dump-spec).\n" +
        "- Quando usar: Para instruir ou auditar pedidos de adesão a ARP (Gerenciador ou Carona).\n" +
        "- Próximo Passo: Consulte inline_markdown (em INLINE) ou inspecione visao_governanca_arp.md/JSON (em POINTER) e DOCX/PDF. <=8KB/<=880B.",
      inputSchema: {
        type: "object",
        properties: {
          arpJsonPath: {
            type: "string",
            description: "Caminho para o JSON de dados da ARP e solicitação de adesão.",
          },
          caseDir: {
            type: "string",
            description: "Diretório do caso DocGov (ex.: 'cases/meu_caso').",
          },
          outputDir: {
            type: "string",
            description: "Diretório de saída para os artefatos compilados.",
          },
          compilationMode: {
            type: "string",
            enum: ["ARP_ADHESION_GRANT_NOTE", "ARP_ADVANTAGE_STUDY", "NONE"],
            description: "Modo documental de compilação OpenXML/PDF.",
          },
          outputFormat: {
            type: "string",
            enum: ["docx", "pdf", "both"],
            description: "Formato do documento compilado (padrão: both).",
          },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "docgov_evaluate_bidding_proposals",
      description:
        "Quando usar: Para julgar propostas TIC sem DEMO (UST/HST/PF/SQUAD), inexequibilidade 75%/85% (Art. 59 §§ 4º–5º, Súmula 262), ACT (Súmula 263), ILG/ILC/ISG/EG, conluio por metadados, Perícia ACT em 7 vetores e fase recursal (Art. 165/168). Próximo Passo: Use inline_markdown ou read_file em artifact_path; <=8KB/<=880B.",
      inputSchema: {
        type: "object",
        properties: {
          proposalJsonPath: { type: "string", description: "Caminho do JSON de proposta/habilitação/ACT." },
          bidding_json_path: { type: "string", description: "Alias para proposalJsonPath." },
          input_json_path: { type: "string", description: "Alias para proposalJsonPath." },
          biddingJsonPath: { type: "string", description: "Alias para proposalJsonPath." },
          outputDir: { type: "string", description: "Diretório de saída dos dossiês e peças compiladas." },
          output_dir: { type: "string", description: "Alias para outputDir." },
          caseDir: { type: "string", description: "Diretório raiz do caso DocGov." },
          case_dir: { type: "string", description: "Alias para caseDir." },
          evaluationStance: {
            type: "string",
            enum: ["DEFENSE", "ATTACK"],
            description: "Postura de julgamento (DEFENSE ou ATTACK).",
          },
          evaluation_stance: { type: "string", enum: ["DEFENSE", "ATTACK"], description: "Alias para evaluationStance." },
          compilationMode: {
            type: "string",
            enum: [
              "PROPOSAL_JUDGMENT_OPINION",
              "ACT_DILIGENCE_LETTER",
              "JUDGMENT_OPINION",
              "ACT_DILIGENCE_REPORT",
              "BOTH",
              "APPEAL_REASONS",
              "APPEAL_COUNTER_REASONS",
              "PREGOEIRO_DECISION",
              "APPEALS_BUNDLE",
              "ALL",
              "NONE",
            ],
            description: "Modo documental OpenXML/PDF.",
          },
          compilation_mode: { type: "string", description: "Alias para compilationMode." },
          outputFormat: { type: "string", enum: ["docx", "pdf", "both"], description: "Formato de saída (docx, pdf ou both)." },
          output_format: { type: "string", enum: ["docx", "pdf", "both"], description: "Alias para outputFormat." },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "docgov_audit_direct_contracting",
      description:
        "Quando usar: Para auditar Contratação Direta — Inexigibilidade (Súmula TCU 255 e mínimo de 3 NFs/contratos), Dispensa por Valor com controle anti-fracionamento (UG e PDM/CATMAT/CATSER) e Oportunidade de Negócio Estatal (Art. 28, § 3º, II Lei 13.303/2016). Próximo Passo: Use inline_markdown ou read_file em artifact_path e confira DOCX/PDF em outputDir; <=8KB/<=880B.",
      inputSchema: {
        type: "object",
        properties: {
          directContractingJsonPath: { type: "string", description: "Caminho do JSON da contratação direta." },
          direct_json_path: { type: "string", description: "Alias para directContractingJsonPath." },
          input_json_path: { type: "string", description: "Alias para directContractingJsonPath." },
          directJsonPath: { type: "string", description: "Alias para directContractingJsonPath." },
          outputDir: { type: "string", description: "Diretório de saída dos dossiês e parecer compilado." },
          output_dir: { type: "string", description: "Alias para outputDir." },
          caseDir: { type: "string", description: "Diretório raiz do caso DocGov." },
          case_dir: { type: "string", description: "Alias para caseDir." },
          compilationMode: {
            type: "string",
            enum: ["DIRECT_CONTRACTING_OPINION", "NONE"],
            description: "Modo documental OpenXML/PDF.",
          },
          compilation_mode: { type: "string", description: "Alias para compilationMode." },
          outputFormat: { type: "string", enum: ["docx", "pdf", "both"], description: "Formato de saída (docx, pdf ou both)." },
          output_format: { type: "string", enum: ["docx", "pdf", "both"], description: "Alias para outputFormat." },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    DEMO_REGIME_TOOL_DEFINITION,
    ENGINEERING_WORKS_TOOL_DEFINITION,
  ];
}
