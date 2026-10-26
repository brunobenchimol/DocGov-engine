import { resolve, dirname, basename } from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  VERSION,
  DOCX_ENGINE_INSTRUCTIONS,
  DOCX_WORKFLOW_GUIDE_TEXT,
} from "../constants/index.ts";
import {
  bootstrapCase,
  formatBootstrapCaseSyntheticResult,
} from "../tools/bootstrap.ts";
import {
  inspectDoc,
  inspectDocx,
  formatInspectDocSyntheticResult,
  formatInspectDocxSyntheticResult,
} from "../tools/inspect.ts";
import {
  buildDocxTemplate,
  formatBuildDocxTemplateSyntheticResult,
} from "../tools/build_template.ts";
import {
  processDocument,
  formatFillDocxTemplateSyntheticResult,
} from "../tools/fill_template.ts";
import {
  generateAuditDocx,
  formatGenerateAuditDocxSyntheticResult,
} from "../tools/audit.ts";
import {
  generateTechnicalNoteDocx,
  formatTechnicalNoteSyntheticResult,
  createTechnicalNoteDataFromDiff,
} from "../tools/technical_note.ts";
import { computeStructuralDiff } from "../core/structural_diff.ts";
import { safeReadJsonFile } from "../utils/json.ts";
import { resolveWorkspacePath } from "../utils/paths.ts";

// ============================================================================
// Modo Servidor MCP (stdio)
// ============================================================================

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
        "Cria a estrutura de pastas do caso (inputs/, state/, templates/, output/), descompacta e ingere automaticamente pacotes compactados (.zip, .tar, .tar.gz, .tgz) presentes em uploadsDir, na raiz do caso ou em inputs/ (com classificação libmagic msooxml, defesa Anti-Zip Slip e achatamento seguro), preserva nomes legíveis ou auto-batiza anexos opacos (media_*) com tipo semântico e hash curto (ex.: ETP_ORGAO_A_3b9d.docx), infere extensões via magic bytes (PK\\x03\\x04 e %PDF), aceita 'fileRenameMap' opcional, copia e inspeciona imediatamente arquivos .docx, .pdf (com pipeline OCR headless em páginas escaneadas) e planilhas nativas .xlsx/.csv em inputs/, submetendo-as ao budget_auditor matemático, detectando páginas escaneadas como imagem ('scanned_pages_detected'), salvando mapas estruturais em state/estrutura_<nome>.json, visões lineares em state/visao_auditoria_<nome>.md com Cartografia Estrutural (outline_headings, page_signals) e Radar das 14 Zonas de Impugnação (Z1..Z14), dossiês cirúrgicos em state/dossie_hotspots_<nome>.md e consolidando o Índice Cartográfico Mestre Unificado em state/indice_mestre_caso.md.\n" +
        "- Quando usar (Pré-condição): Primeiro passo obrigatório no ciclo de vida de qualquer caso/processo no DocGov.\n" +
        "- Pós-condição & Próximo Passo: Pastas criadas, pacotes descompactados, arquivos batizados e documentos .docx/.pdf inspecionados. Próximo passo recomendado: ler 'state/indice_mestre_caso.md' ou 'state/visao_auditoria_<nome>.md', inspecionar detalhes adicionais com 'inspect_doc' ou criar o 'slots_manifest.json' e chamar 'build_docx_template'.",
      inputSchema: {
        type: "object",
        required: ["caseDir"],
        properties: {
          caseDir: {
            type: "string",
            description:
              "Caminho absoluto ou relativo da pasta raiz do caso (ex.: 'C:/workspace/cases/caso_exemplo' ou 'cases/caso_exemplo'). As subpastas inputs/, state/, templates/ e output/ serão criadas dentro dele.",
          },
          uploadsDir: {
            type: "string",
            description:
              "Caminho opcional da pasta contendo os uploads originais do usuário (ex.: 'C:/workspace/.user_uploaded'). Arquivos .docx, .pdf, planilhas e pacotes .zip/.tar válidos são descompactados, copiados e inspecionados com Cartografia e Radar das 14 Zonas.",
          },
          fileRenameMap: {
            type: "object",
            description:
              "Mapeamento explícito opcional de nomes de arquivos originais para nomes canônicos (ex.: { 'media_1792069974647_14a93b9d': 'ETP_Modelo.docx' }). Se omitido, o motor preserva nomes legíveis ou auto-batiza anexos opacos com base no conteúdo e magic bytes.",
            additionalProperties: {
              type: "string",
            },
          },
        },
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    {
      name: "inspect_doc",
      description:
        "Realiza a engenharia reversa estrutural completa de documentos individuais Word (.docx), PDF (.pdf com agrupamento Y e colunas), planilhas Excel (.xlsx com indexação exata por r='A1'), CSV (.csv) ou textos/markdown (.md/.txt), com guardrail fail-fast que rejeita pacotes compactados (.zip, .tar) orientando o uso de 'bootstrap_case', com fusão multi-página, resolução de células multilinha, pipeline OCR headless automático em páginas escaneadas ('scanned_pages_detected' com 'ocr_applied: true') e auditoria orçamentária determinística integrada (Z10/Z12), construindo no topo do JSON o índice estrutural rápido 'toc_map', a Cartografia Estrutural em 3 camadas ('outline_headings', 'page_signals' e 'impugnation_zones' Z1..Z14), detectando páginas escaneadas como imagem ('scanned_pages_detected'), gerando o dossiê executivo de pontos quentes ('dossie_hotspots_<nome>.md' com contexto expandido ±12 linhas), calculando o 'structure_fingerprint', executando matching 1-para-N contra o cache global (core/registry/templates/) com rastreabilidade temporal (created_at, updated_at, age_days, cache_date_status, engine_version, slots_count e retrocompatibilidade v0.6.4) e reancoragem automática (Auto-Offset v0.6.0 gerando adapted_slots_manifest.json em drift 75%-99%), gerando a visão linear compacta de auditoria ('visao_auditoria_<nome>.md' com Bloco 1 Cartográfico + Radar Z1..Z14 e Bloco 2 paginado [PAG_XXX | LYYYY] ou [P...]) e gravando o JSON detalhado com retorno sintético executivo 'toc_summary' (< 1 KB, margem de segurança < 920 bytes).\n" +
        "- Quando usar (Pré-condição): Deve ser chamada após 'bootstrap_case' para inspecionar um documento individual .docx, .pdf, .xlsx, .csv ou .md específico, descobrir os índices exatos ou reaproveitar templates do cache global, OU após 'fill_docx_template' sobre o arquivo gerado em output/.\n" +
        "- Pós-condição & Próximo Passo: Grava em disco o mapa estrutural com toc_map/cartografia, o markdown 'visao_auditoria_<nome>.md' e o dossiê 'dossie_hotspots_<nome>.md'. Se template_match for EXACT ou MODIFIED, informe a data do cache ao usuário no Gate 1 e chame 'build_docx_template'; se NEW ou PDF, leia o dossiê de hotspots, a visão de auditoria ou elabore o slots_manifest.json.",
      inputSchema: {
        type: "object",
        required: ["filePath"],
        properties: {
          filePath: {
            type: "string",
            description:
              "Caminho absoluto ou relativo do arquivo Word (.docx) ou PDF (.pdf) a ser inspecionado (ex.: 'C:/workspace/cases/caso_exemplo/inputs/edital.pdf' ou 'C:/workspace/cases/caso_exemplo/inputs/modelo_etp.docx').",
          },
          docxPath: {
            type: "string",
            description:
              "Alias retrocompatível para filePath (caminho do arquivo .docx ou .pdf).",
          },
          outputPath: {
            type: "string",
            description:
              "Caminho onde o mapa estrutural JSON detalhado será gravado no disco (ex.: 'C:/workspace/cases/caso_exemplo/state/estrutura_etp.json'). Se omitido, salva automaticamente como estrutura_<stem>.json.",
          },
          compact: {
            type: "boolean",
            description:
              "Se true (padrão), omite parágrafos e células vazias no JSON de saída para economizar espaço em disco, preservando intactos os índices originais 0-based, o toc_map e a cartografia.",
          },
          compareWithPath: {
            type: "string",
            description:
              "Caminho opcional de um documento base/anterior (.docx ou .pdf) para executar o Diff Estrutural e Semântico Multi-Versão. Se fornecido, gera state/diff_documental_<stem>.md e state/diff_documental_<stem>.json comparando alterações, redações e impacto nas 14 Zonas (v1.1.0).",
          },
        },
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    {
      name: "build_docx_template",
      description:
        "Transforma um documento Word (.docx) bruto em um template parametrizado com tags {{...}} a partir de regras definidas em um slots_manifest.json, com auto-reparo e diagnóstico cirúrgico de JSON, preservando 100% da formatação visual (<w:pPr>, <w:rPr>, estilos, cabeçalhos e tabelas). Suporta coordenadas compactas do toc_map ('coord': 'T0.R1.C1' ou 'coord': 'P2', com ou sem colchetes), array raiz unificado 'slots: [...]', aliases ('col_index', 'paragraph_index'), validação fail-fast estrita com padrão Exact Copy-Paste Error (Zero Silent No-Op) e 'saveToRegistry: true' para homologação no cache global cross-órgão (v0.6.2).\n" +
        "- Quando usar (Pré-condição): Deve ser chamada após 'inspect_doc' e após a elaboração/adaptação do arquivo 'slots_manifest.json'.\n" +
        "- Pós-condição & Próximo Passo: Gera o template .docx parametrizado com tags em outputPath (e opcionalmente registra no cache global). Próximo passo recomendado: elaborar o 'estado_caso.json' com os dados do processo e chamar 'fill_docx_template'.",
      inputSchema: {
        type: "object",
        required: ["sourcePath", "manifestPath", "outputPath"],
        properties: {
          sourcePath: {
            type: "string",
            description:
              "Caminho do arquivo Word (.docx) bruto original, sem tags (ex.: 'C:/workspace/cases/caso_exemplo/inputs/modelo_etp.docx').",
          },
          manifestPath: {
            type: "string",
            description:
              "Caminho do arquivo JSON de manifesto contendo as regras de slots (ex.: 'C:/workspace/cases/caso_exemplo/state/slots_manifest.json' ou 'state/adapted_slots_manifest.json'). Suporta notação compacta com { slots: [{ coord: 'T0.R1.C1', tag: '...' }, { coord: 'P2', tag: '...' }] } ou arrays canônicos como replace_paragraphs, replace_table_cells, loop_table_rows e replace_inline. Validação estrita: proíbe propriedades inventadas.",
          },
          outputPath: {
            type: "string",
            description:
              "Caminho onde o novo arquivo template .docx parametrizado será salvo (ex.: 'C:/workspace/cases/caso_exemplo/state/template_etp.docx').",
          },
          saveToRegistry: {
            type: "boolean",
            description:
              "Se true, salva o manifesto homologado e a impressão digital estrutural no cache global de templates (core/registry/templates/) para reuso e matching em futuros órgãos.",
          },
          templateId: {
            type: "string",
            description:
              "Identificador único opcional do template no registro global (ex.: 'etp_compras_v1'). Se omitido, deriva do nome base do arquivo.",
          },
        },
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    {
      name: "fill_docx_template",
      description:
        "Injeta os dados de um estado_caso.json em um template Word (.docx) parametrizado com tags {{...}}, com auto-reparo de JSON, desaninhamento automático (unflatten) de chaves com notação de ponto (ex.: 'etp.necessidade'), resolvendo variáveis simples, loops FOR em tabelas, blocos condicionais IF, conversão de quebras \\n em parágrafos reais, negrito seletivo (**texto**) e expansão recursiva de listas multinível via Motor Híbrido v0.7.0 (word/numbering.xml + <w:numPr> com startOverride fora de tabelas e Hanging Indent com <w:tab/> dentro de tabelas).\n" +
        "- Quando usar (Pré-condição): Deve ser chamada após 'build_docx_template' gerar o template e após a elaboração do 'estado_caso.json'.\n" +
        "- Pós-condição & Próximo Passo: Gera a minuta final do documento Word em outputPath e executa automaticamente a inspeção estrutural gerando a visão linear de auditoria em state/visao_auditoria_<stem>.md. Próximo: acione o Auditor Externo lendo diretamente a visão linear (dispensado rodar inspect_doc novamente).",
      inputSchema: {
        type: "object",
        required: ["templatePath", "statePath", "outputPath"],
        properties: {
          templatePath: {
            type: "string",
            description:
              "Caminho do arquivo modelo Word (.docx) parametrizado com tags {{...}} gerado pelo build_docx_template (ex.: 'C:/workspace/cases/caso_exemplo/state/template_etp.docx').",
          },
          statePath: {
            type: "string",
            description:
              "Caminho do arquivo JSON contendo o estado do caso/processo com os dados a serem injetados nas tags (ex.: 'C:/workspace/cases/caso_exemplo/state/estado_caso.json'). Objeto contendo campos correspondentes às tags do template (ex.: { processo_id: '...', objeto: { descricao: '...' }, itens: [...] }).",
          },
          outputPath: {
            type: "string",
            description:
              "Caminho de saída onde o documento final compilado será gerado (ex.: 'C:/workspace/cases/caso_exemplo/output/ETP_Exemplo.docx').",
          },
          autoInspect: {
            type: "boolean",
            description:
              "Executa automaticamente a inspeção estrutural pós-compilação gerando state/inspecao_<stem>.json e state/visao_auditoria_<stem>.md para auditoria imediata. Padrão: true.",
          },
          outputFormat: {
            type: "string",
            enum: ["docx", "pdf", "both"],
            description:
              "Formato de saída do documento gerado: 'docx' (apenas Word, padrão), 'pdf' (converte para PDF via pipeline híbrido Word COM/Pure-JS e auto-inspeciona o PDF) ou 'both' (mantém o .docx e gera também o .pdf correspondente).",
          },
        },
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    {
      name: "generate_audit_docx",
      description:
        "Gera um Relatório de Auditoria Técnico-Jurídica, Matriz de Gerenciamento de Riscos (Art. 18, X e Art. 22 Lei 14.133/2021) ou Checklist de Conformidade Normativa (TCU/AGU/MGI) em formato Word (.docx) e PDF em layout editorial vertical corrido (folha A4 retrato, zero tabelas <w:tbl>, 100% largura útil), com validação fail-fast estrita (padrão Exact Copy-Paste Error v0.6.2), sanitização automática de crases Markdown, coordenadas e códigos de enum, e transcrição integral de trechos probatórios (trechos_documento) em blocos de citação recuados.\n" +
        "- Quando usar (Pré-condição): Deve ser chamada após a auditoria do documento gerado e consolidação do arquivo 'relatorio_auditoria.json'.\n" +
        "- Pós-condição & Próximo Passo: Gera o documento .docx executivo do parecer de auditoria em outputPath. Conclui formalmente o ciclo de auditoria do processo.",
      inputSchema: {
        type: "object",
        required: ["auditJsonPath", "outputPath"],
        properties: {
          auditJsonPath: {
            type: "string",
            description:
              "Caminho do arquivo relatorio_auditoria.json gerado pelo agente auditor (ex.: 'C:/workspace/cases/caso_exemplo/state/relatorio_auditoria.json'). Estrutura esperada: { processo_id, artefato_auditado, status_global, contagem: { bloqueantes, alertas, conformes }, resumo_executivo, apontamentos: [{ id, vulnerabilidade, status, base_legal, analise, redacao_saneadora, trechos_documento: [{ secao_legivel, texto_transcrito }] }] }.",
          },
          outputPath: {
            type: "string",
            description:
              "Caminho onde o arquivo .docx do parecer de auditoria executivo será salvo (ex.: 'C:/workspace/cases/caso_exemplo/output/Relatorio_Auditoria_ETP.docx').",
          },
          outputFormat: {
            type: "string",
            enum: ["docx", "pdf", "both"],
            description:
              "Formato de saída do parecer de auditoria: 'docx' (apenas Word, padrão), 'pdf' (converte para PDF via pipeline híbrido Word COM/Pure-JS) ou 'both' (mantém o .docx e gera também o .pdf correspondente).",
          },
        },
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    {
      name: "generate_technical_note_docx",
      description:
        "Gera uma Nota Técnica Comparativa Padronizada de Evolução Documental ('Antes vs. Depois', Marco 6) em Word (.docx) e PDF em layout editorial vertical corrido (folha A4 retrato, zero tabelas <w:tbl>, 100% largura útil), com destaque visual colorido por cards com bordas laterais (verde para inclusão, vermelho para supressão, azul para alteração), renderização granular de diff de tokens inline e fundamentação técnica/jurídica individualizada por cláusula alterada.\n" +
        "- Modos de operação híbridos:\n" +
        "  1) Direto via JSON: forneça 'noteJsonPath' e 'outputPath';\n" +
        "  2) Comparativo via arquivos: forneça 'oldPath' e 'newPath' (.docx, .pdf ou .json de estrutura) + 'outputPath' (e opcionalmente 'noteJsonPath' para enriquecer com justificativas elaboradas pelo agente).\n" +
        "- Quando usar (Pré-condição): Após alterações substantivas em minutas ou artefatos instrutórios (TR, ETP, Edital) para justificar a evolução aos órgãos de controle (TCU, AGU, Controle Interno).\n" +
        "- Pós-condição & Próximo Passo: Gera a Nota Técnica executiva em outputPath (.docx e opcionalmente .pdf). Conclui o ciclo de justificação e governança de alterações.",
      inputSchema: {
        type: "object",
        required: ["outputPath"],
        properties: {
          outputPath: {
            type: "string",
            description:
              "Caminho onde o arquivo .docx da nota técnica será gerado (ex.: 'C:/workspace/cases/caso_exemplo/output/Nota_Tecnica_Evolucao.docx').",
          },
          noteJsonPath: {
            type: "string",
            description:
              "Caminho do arquivo nota_tecnica.json estruturado com a evolução de cláusulas e justificativas (ex.: 'C:/workspace/cases/caso_exemplo/state/nota_tecnica.json'). Obrigatório no modo direto; opcional no modo comparativo via oldPath/newPath.",
          },
          oldPath: {
            type: "string",
            description:
              "Caminho do documento base/anterior (.docx, .pdf ou .json de estrutura) para cálculo automático do diff de evolução.",
          },
          newPath: {
            type: "string",
            description:
              "Caminho do documento revisado/novo (.docx, .pdf ou .json de estrutura) para cálculo automático do diff de evolução.",
          },
          outputFormat: {
            type: "string",
            enum: ["docx", "pdf", "both"],
            description:
              "Formato de saída da nota técnica: 'docx' (apenas Word, padrão), 'pdf' (converte para PDF via pipeline híbrido Word COM/Pure-JS) ou 'both' (mantém o .docx e gera também o .pdf correspondente).",
          },
        },
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
  ];
}

export async function runMcpServer() {
  const server = new Server(
    { name: "docgov-engine", version: VERSION },
    {
      capabilities: {
        tools: {},
        prompts: {},
      },
      instructions: DOCX_ENGINE_INSTRUCTIONS,
    }
  );

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: getMcpPromptsDefinition(),
    };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const promptName = request.params.name;
    if (promptName === "docx_workflow_guide") {
      return {
        description: "Guia Canônico do Ciclo de Vida docgov-engine",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: DOCX_WORKFLOW_GUIDE_TEXT,
            },
          },
        ],
      };
    }
    throw new Error(`Prompt desconhecido: ${promptName}`);
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: getMcpToolsDefinition(),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;

    try {
      if (toolName === "bootstrap_case") {
        const { caseDir, uploadsDir, fileRenameMap } = request.params
          .arguments as {
          caseDir: string;
          uploadsDir?: string;
          fileRenameMap?: Record<string, string>;
        };
        const resolvedCaseDir = resolveWorkspacePath(caseDir);
        const resolvedUploadsDir = uploadsDir ? resolveWorkspacePath(uploadsDir) : undefined;
        const res = await bootstrapCase(resolvedCaseDir, resolvedUploadsDir, { fileRenameMap });
        const synthetic = formatBootstrapCaseSyntheticResult(res, resolvedCaseDir);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(synthetic, null, 2),
            },
          ],
        };
      }

      if (toolName === "inspect_doc" || toolName === "inspect_docx") {
        const args = (request.params.arguments || {}) as {
          filePath?: string;
          docxPath?: string;
          outputPath?: string;
          compact?: boolean;
          compareWithPath?: string;
        };
        const rawPath = args.filePath || args.docxPath;
        if (!rawPath) {
          throw new Error("Parâmetro obrigatório 'filePath' não fornecido para inspect_doc.");
        }
        const resolvedDoc = resolveWorkspacePath(rawPath);
        const docStem = basename(resolvedDoc).replace(
          /\.(?:docx|pdf|xlsx|xls|csv|md|markdown|txt|text)$/i,
          ""
        );
        const effectiveOutputPath = args.outputPath
          ? resolveWorkspacePath(args.outputPath)
          : resolve(dirname(resolvedDoc), `estrutura_${docStem}.json`);
        const resolvedCompare = args.compareWithPath
          ? resolveWorkspacePath(args.compareWithPath)
          : undefined;

        const inspection = await inspectDoc(
          resolvedDoc,
          effectiveOutputPath,
          args.compact !== false,
          { compareWithPath: resolvedCompare }
        );

        const synthetic = formatInspectDocSyntheticResult(
          rawPath,
          effectiveOutputPath,
          inspection
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(synthetic, null, 2),
            },
          ],
        };
      }

      if (toolName === "build_docx_template") {
        const {
          sourcePath,
          manifestPath,
          outputPath,
          saveToRegistry,
          templateId,
        } = request.params.arguments as {
          sourcePath: string;
          manifestPath: string;
          outputPath: string;
          saveToRegistry?: boolean;
          templateId?: string;
        };
        const resolvedSource = resolveWorkspacePath(sourcePath);
        const resolvedManifest = resolveWorkspacePath(manifestPath);
        const resolvedOutput = resolveWorkspacePath(outputPath);
        const result = await buildDocxTemplate(
          resolvedSource,
          resolvedManifest,
          resolvedOutput,
          { saveToRegistry, templateId }
        );
        const synthetic = formatBuildDocxTemplateSyntheticResult(
          resolvedOutput,
          result
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(synthetic, null, 2),
            },
          ],
        };
      }

      if (toolName === "fill_docx_template") {
        const {
          templatePath,
          statePath,
          outputPath,
          autoInspect,
          outputFormat,
        } = request.params.arguments as {
          templatePath: string;
          statePath: string;
          outputPath: string;
          autoInspect?: boolean;
          outputFormat?: "docx" | "pdf" | "both";
        };
        const resolvedTemplate = resolveWorkspacePath(templatePath);
        const resolvedState = resolveWorkspacePath(statePath);
        const resolvedOutput = resolveWorkspacePath(outputPath);
        const result = await processDocument(
          resolvedTemplate,
          resolvedState,
          resolvedOutput,
          { autoInspect, outputFormat }
        );
        const synthetic = formatFillDocxTemplateSyntheticResult(result);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(synthetic, null, 2),
            },
          ],
        };
      }

      if (toolName === "generate_audit_docx") {
        const { auditJsonPath, outputPath, outputFormat } =
          request.params.arguments as {
            auditJsonPath: string;
            outputPath: string;
            outputFormat?: "docx" | "pdf" | "both";
          };
        const resolvedAuditJson = resolveWorkspacePath(auditJsonPath);
        const resolvedOutput = resolveWorkspacePath(outputPath);
        const result = await generateAuditDocx(resolvedAuditJson, resolvedOutput, {
          outputFormat,
        });
        const synthetic = formatGenerateAuditDocxSyntheticResult(result);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(synthetic, null, 2),
            },
          ],
        };
      }

      if (toolName === "generate_technical_note_docx") {
        const {
          noteJsonPath,
          oldPath,
          newPath,
          outputPath,
          outputFormat,
        } = request.params.arguments as {
          noteJsonPath?: string;
          oldPath?: string;
          newPath?: string;
          outputPath: string;
          outputFormat?: "docx" | "pdf" | "both";
        };

        if (!outputPath) {
          throw new Error(
            "Parâmetro obrigatório 'outputPath' não fornecido para generate_technical_note_docx."
          );
        }

        const resolvedOutput = resolveWorkspacePath(outputPath);
        let result;
        if (oldPath && newPath) {
          const resolvedOld = resolveWorkspacePath(oldPath);
          const resolvedNew = resolveWorkspacePath(newPath);

          const oldInspection = resolvedOld.toLowerCase().endsWith(".json")
            ? safeReadJsonFile(resolvedOld)
            : await inspectDoc(resolvedOld, undefined, true);
          const newInspection = resolvedNew.toLowerCase().endsWith(".json")
            ? safeReadJsonFile(resolvedNew)
            : await inspectDoc(resolvedNew, undefined, true);

          const diff = computeStructuralDiff(
            oldInspection,
            newInspection,
            resolvedOld,
            resolvedNew
          );

          let baseData;
          if (noteJsonPath) {
            baseData = safeReadJsonFile(resolveWorkspacePath(noteJsonPath));
          }

          const noteData = createTechnicalNoteDataFromDiff(
            diff,
            resolvedOld,
            resolvedNew,
            baseData
          );
          result = await generateTechnicalNoteDocx(noteData, resolvedOutput, {
            outputFormat,
          });
        } else if (noteJsonPath) {
          result = await generateTechnicalNoteDocx(
            resolveWorkspacePath(noteJsonPath),
            resolvedOutput,
            { outputFormat }
          );
        } else {
          throw new Error(
            "Parâmetro obrigatório ausente: forneça 'noteJsonPath' OU o par 'oldPath' e 'newPath' para generate_technical_note_docx."
          );
        }

        const synthetic = formatTechnicalNoteSyntheticResult(result);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(synthetic, null, 2),
            },
          ],
        };
      }
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Falha ao executar ${toolName}: ${err.message}`,
          },
        ],
      };
    }

    throw new Error(`Ferramenta desconhecida: ${toolName}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

