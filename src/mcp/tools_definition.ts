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
        "Inicializa caso (inputs/, state/, templates/, output/, assets/), descompacta pacotes, auto-batiza media_* ou aplica fileRenameMap, inspeciona documentos e gera indice_mestre_caso.md.\n" +
        "- Quando usar: 1º passo obrigatório (restrito a cases/<slug>/).\n" +
        "- Próximo Passo: Leia indice_mestre_caso.md ou chame inspect_doc / build_docx_template.",
      inputSchema: {
        type: "object",
        required: ["caseDir"],
        properties: {
          caseDir: {
            type: "string",
            description: "Diretório raiz do caso.",
          },
          uploadsDir: {
            type: "string",
            description: "Pasta opcional de uploads.",
          },
          fileRenameMap: {
            type: "object",
            description: "Mapa opcional de renomeação de arquivos.",
            additionalProperties: { type: "string" },
          },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "inspect_doc",
      description:
        "Engenharia reversa de .docx/.pdf/.xlsx/.csv/.md/.txt: toc_map, Z1..Z14, orçamento, structure_fingerprint, cache (created_at/Auto-Offset), visao_auditoria_*.md, dossie_hotspots_*.md e toc_summary.\n" +
        "- Quando usar: Inspecionar documento ou diff.\n" +
        "- Próximo Passo: Em EXACT/MODIFIED, chame build_docx_template; em NEW/PDF, leia o dossiê/visão.",
      inputSchema: {
        type: "object",
        required: ["filePath"],
        properties: {
          filePath: { type: "string", description: "Caminho do arquivo alvo." },
          docxPath: { type: "string", description: "Alias para filePath." },
          outputPath: { type: "string", description: "Caminho de saída do JSON." },
          compact: { type: "boolean", description: "Omite parágrafos/células vazias." },
          compareWithPath: { type: "string", description: "Documento base para Diff." },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "build_docx_template",
      description:
        "Parametriza .docx em template {{...}} via slots_manifest.json (auto-reparo, Heading Guard, Exact Copy-Paste Error / Zero Silent No-Op, saveToRegistry).\n" +
        "- Quando usar: Após inspect_doc e slots_manifest.json (cases/<slug>/).\n" +
        "- Próximo Passo: Preencha estado_caso.json e chame fill_docx_template.",
      inputSchema: {
        type: "object",
        required: ["sourcePath", "manifestPath", "outputPath"],
        properties: {
          sourcePath: { type: "string", description: "Caminho do .docx bruto." },
          manifestPath: {
            type: "string",
            description:
              "JSON de slots (coord: 'T0.R1.C1'/'P2' ou arrays canônicos).",
          },
          outputPath: { type: "string", description: "Caminho do template .docx." },
          saveToRegistry: { type: "boolean", description: "Salva no cache global." },
          templateId: { type: "string", description: "ID opcional no registro." },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "fill_docx_template",
      description:
        "Injeta estado_caso.json (auto-reparo, unflatten) em .docx: FOR/IF, <w:tbl>, listas (word/numbering.xml), highlight, comments.xml e DOCX/PDF.\n" +
        "- Quando usar: Após build_docx_template (cases/<slug>/).\n" +
        "- Próximo Passo: Gera minuta final e state/visao_auditoria_<stem>.md.",
      inputSchema: {
        type: "object",
        required: ["templatePath", "statePath", "outputPath"],
        properties: {
          templatePath: { type: "string", description: "Caminho do template .docx." },
          statePath: { type: "string", description: "Caminho do JSON de estado." },
          outputPath: { type: "string", description: "Caminho da minuta final." },
          autoInspect: { type: "boolean", description: "Gera visao_auditoria (padrão: true)." },
          outputFormat: { type: "string", enum: ["docx", "pdf", "both"], description: "Formato (padrão: docx)." },
          highlightPlaceholders: { type: "boolean", description: "Destaca [A DEFINIR] (padrão: true)." },
          comments: {
            type: "array",
            description: "Comentários Word (mesclados após _comments).",
            items: {
              type: "object",
              required: ["anchor_text", "text"],
              properties: {
                slot_key: { type: "string", description: "Slot p/ delimitar busca." },
                anchor_text: { type: "string", description: "Texto âncora no documento." },
                author: { type: "string", description: "Autor do comentário." },
                initials: { type: "string", description: "Iniciais do autor." },
                text: { type: "string", description: "Texto do comentário." },
              },
            },
          },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "generate_audit_docx",
      description:
        "Compila Relatório de Auditoria, Matriz de Riscos, Checklist ou Impugnação em DOCX/PDF A4 vertical (Exact Copy-Paste Error).\n" +
        "- Quando usar: Após relatorio_auditoria.json ou peca_impugnacao.json (cases/<slug>/).\n" +
        "- Próximo Passo: Gera parecer/peça em outputPath.",
      inputSchema: {
        type: "object",
        required: ["auditJsonPath", "outputPath"],
        properties: {
          auditJsonPath: { type: "string", description: "Caminho do JSON de auditoria/peça." },
          outputPath: { type: "string", description: "Caminho de saída do arquivo." },
          outputFormat: { type: "string", enum: ["docx", "pdf", "both"], description: "Formato: docx, pdf ou both." },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "generate_technical_note_docx",
      description:
        "Compila Nota Técnica ('Antes vs. Depois') ou Contrarrazões em DOCX/PDF A4 com diff granular via noteJsonPath ou oldPath/newPath.\n" +
        "- Quando usar: Justificar revisões de TR/ETP/Edital (cases/<slug>/).\n" +
        "- Próximo Passo: Gera Nota Técnica em outputPath.",
      inputSchema: {
        type: "object",
        required: ["outputPath"],
        properties: {
          outputPath: { type: "string", description: "Caminho de saída da nota." },
          noteJsonPath: { type: "string", description: "Caminho do JSON da nota." },
          oldPath: { type: "string", description: "Documento base para diff." },
          newPath: { type: "string", description: "Documento revisado para diff." },
          outputFormat: { type: "string", enum: ["docx", "pdf", "both"], description: "Formato: docx, pdf ou both." },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "fetch_pncp",
      description:
        "Baixa metadados e anexos de contratação no PNCP para inputs/pncp_<shortname>/ com descompactação e catalogação (IN 65/2021).\n" +
        "- Quando usar: Com identificador/URL PNCP (cases/<slug>/).\n" +
        "- Próximo Passo: Leia state/indice_pncp_<shortname>.md.",
      inputSchema: {
        type: "object",
        required: ["caseDir", "pncpIdOrUrl"],
        properties: {
          caseDir: { type: "string", description: "Diretório raiz do caso." },
          pncpIdOrUrl: { type: "string", description: "ID oficial ou URL PNCP." },
          shortname: { type: "string", description: "Apelido curto opcional." },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "search_pncp",
      description:
        "Busca textual multi-query ('|') no PNCP para editais de referência (IN 65/2021), acumulando resultados (fora de cases/, usa %TEMP%).\n" +
        "- Quando usar: Descobrir contratações similares.\n" +
        "- Próximo Passo: Leia state/pncp_search_results.md e chame fetch_pncp.",
      inputSchema: {
        type: "object",
        required: ["caseDir", "query"],
        properties: {
          caseDir: { type: "string", description: "Diretório raiz do caso." },
          query: { type: "string", description: "Termos de busca (aceita '|')." },
          status: { type: "string", enum: ["todas", "recebendo_proposta", "encerradas"], description: "Filtro de situação." },
          uf: { type: "string", description: "Filtro de UF." },
          modalidade: { type: "string", description: "Filtro de modalidade." },
          limit: { type: "number", description: "Máximo de resultados." },
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
        "Auditoria contratual: aditivos (25%/50%), batimento quadripartite (ARP), reajustes (12m), PAS (LINDB Art. 22, glosa ANS), IN 65/2021 e álea.\n" +
        "- Quando usar: Fiscalizar aditivos, sobrepreço, reajustes, PAS ou reequilíbrio.\n" +
        "- Próximo Passo: Use inline_markdown ou read_file; <=8KB/<=880B.",
      inputSchema: {
        type: "object",
        properties: {
          contractJsonPath: {
            type: "string",
            description: "Caminho do JSON contratual/PAS.",
          },
          caseDir: {
            type: "string",
            description: "Diretório raiz do caso.",
          },
          outputDir: {
            type: "string",
            description: "Diretório de saída.",
          },
          auditType: {
            type: "string",
            enum: ["FULL", "ADDENDUM_LIMITS", "TRIPARTITE_MATCH", "READJUSTMENT", "PAS_SANCTIONS", "PRICE_BASKET"],
            description: "Foco da auditoria (padrão: FULL).",
          },
          compilationMode: {
            type: "string",
            enum: ["NONE", "PAS_NOTIFICATION", "SANCTION_DOSIMETRY_OPINION", "DOSIMETRY_OPINION", "BOTH"],
            description: "Modo documental OpenXML/PDF (padrão: NONE).",
          },
          outputFormat: {
            type: "string",
            enum: ["docx", "pdf", "both"],
            description: "Formato de saída (padrão: both).",
          },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "docgov_govern_arp",
      description:
        "Governança de ARP e adesões (caronas): livro-razão 50%/200%, compatibilidade federativa/TIC, vigência (12+12m) e notas DOCX/PDF.\n" +
        "- Quando usar: Instruir ou auditar adesões a ARP (Gerenciador/Carona).\n" +
        "- Próximo Passo: Use inline_markdown ou read_file em artifact_path; <=8KB/<=880B.",
      inputSchema: {
        type: "object",
        properties: {
          arpJsonPath: {
            type: "string",
            description: "Caminho do JSON da ARP/adesão.",
          },
          caseDir: {
            type: "string",
            description: "Diretório raiz do caso.",
          },
          outputDir: {
            type: "string",
            description: "Diretório de saída.",
          },
          compilationMode: {
            type: "string",
            enum: ["ARP_ADHESION_GRANT_NOTE", "ARP_ADVANTAGE_STUDY", "NONE"],
            description: "Modo documental OpenXML/PDF.",
          },
          outputFormat: {
            type: "string",
            enum: ["docx", "pdf", "both"],
            description: "Formato de saída (padrão: both).",
          },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "docgov_evaluate_bidding_proposals",
      description:
        "Julga propostas TIC (UST/HST/PF/SQUAD), inexequibilidade 75%/85%, ACT (Súm. 263), ILG/ILC/ISG, conluio, perícia 7 vetores e recursos.\n" +
        "- Quando usar: Julgar propostas, ACT e recursos TIC sem DEMO.\n" +
        "- Próximo Passo: Use inline_markdown ou read_file em artifact_path; <=8KB/<=880B.",
      inputSchema: {
        type: "object",
        properties: {
          proposalJsonPath: { type: "string", description: "Caminho do JSON da proposta." },
          bidding_json_path: { type: "string", description: "Alias para proposalJsonPath." },
          input_json_path: { type: "string", description: "Alias para proposalJsonPath." },
          biddingJsonPath: { type: "string", description: "Alias para proposalJsonPath." },
          outputDir: { type: "string", description: "Diretório de saída." },
          output_dir: { type: "string", description: "Alias para outputDir." },
          caseDir: { type: "string", description: "Diretório raiz do caso." },
          case_dir: { type: "string", description: "Alias para caseDir." },
          evaluationStance: {
            type: "string",
            enum: ["DEFENSE", "ATTACK"],
            description: "Postura (DEFENSE ou ATTACK).",
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
          outputFormat: { type: "string", enum: ["docx", "pdf", "both"], description: "Formato (docx, pdf ou both)." },
          output_format: { type: "string", enum: ["docx", "pdf", "both"], description: "Alias para outputFormat." },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "docgov_audit_direct_contracting",
      description:
        "Audita Contratação Direta: Inexigibilidade (Súm. 255, 3 NFs), Dispensa (anti-fracionamento UG/CATMAT) e Oportunidade Estatal (Art. 28 §3º II).\n" +
        "- Quando usar: Auditar processos de inexigibilidade, dispensa ou estatal.\n" +
        "- Próximo Passo: Use inline_markdown ou read_file em artifact_path; <=8KB/<=880B.",
      inputSchema: {
        type: "object",
        properties: {
          directContractingJsonPath: { type: "string", description: "Caminho do JSON da dispensa/inex." },
          direct_json_path: { type: "string", description: "Alias para directContractingJsonPath." },
          input_json_path: { type: "string", description: "Alias para directContractingJsonPath." },
          directJsonPath: { type: "string", description: "Alias para directContractingJsonPath." },
          outputDir: { type: "string", description: "Diretório de saída." },
          output_dir: { type: "string", description: "Alias para outputDir." },
          caseDir: { type: "string", description: "Diretório raiz do caso." },
          case_dir: { type: "string", description: "Alias para caseDir." },
          compilationMode: {
            type: "string",
            enum: ["DIRECT_CONTRACTING_OPINION", "NONE"],
            description: "Modo documental OpenXML/PDF.",
          },
          compilation_mode: { type: "string", description: "Alias para compilationMode." },
          outputFormat: { type: "string", enum: ["docx", "pdf", "both"], description: "Formato (docx, pdf ou both)." },
          output_format: { type: "string", enum: ["docx", "pdf", "both"], description: "Alias para outputFormat." },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    DEMO_REGIME_TOOL_DEFINITION,
    ENGINEERING_WORKS_TOOL_DEFINITION,
  ];
}
