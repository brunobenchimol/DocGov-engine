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
  inspectDocx,
  formatInspectDocxSyntheticResult,
} from "../tools/inspect.ts";
import {
  buildDocxTemplate,
  formatBuildDocxTemplateSyntheticResult,
} from "../tools/build_template.ts";
import { processDocument } from "../tools/fill_template.ts";
import { generateAuditDocx } from "../tools/audit.ts";

// ============================================================================
// Modo Servidor MCP (stdio)
// ============================================================================

export function getMcpPromptsDefinition() {
  return [
    {
      name: "docx_workflow_guide",
      description:
        "Guia canônico e manual de arquitetura do docgov-docx: ordem do pipeline (1..5), sintaxe de tags, estrutura do slots_manifest.json e boas práticas de injeção.",
      arguments: [],
    },
  ];
}

export function getMcpToolsDefinition() {
  return [
    {
      name: "bootstrap_case",
      description:
        "Cria a estrutura de pastas do caso (inputs/, state/, output/), preserva nomes legíveis ou auto-batiza anexos opacos (media_*) com tipo semântico e hash curto (ex.: ETP_ORGAO_A_3b9d.docx), infere extensões via magic bytes (PK\\x03\\x04 e %PDF), aceita 'fileRenameMap' opcional, copia minutas .docx para inputs/ de forma síncrona imediata salvando mapas estruturais em state/estrutura_<nome>.json, e inicia salvaguarda assíncrona de PDFs/anexos pesados em segundo plano.\n" +
        "- Quando usar (Pré-condição): Primeiro passo obrigatório no ciclo de vida de qualquer caso/processo no DocGov.\n" +
        "- Pós-condição & Próximo Passo: Pastas criadas, arquivos batizados e minutas .docx inspecionadas. Próximo passo recomendado: inspecionar detalhes adicionais com 'inspect_docx' (se necessário) ou criar o 'slots_manifest.json' e chamar 'build_docx_template'.",
      inputSchema: {
        type: "object",
        required: ["caseDir"],
        properties: {
          caseDir: {
            type: "string",
            description:
              "Caminho absoluto ou relativo da pasta raiz do caso (ex.: 'C:/workspace/cases/caso_exemplo' ou 'cases/caso_exemplo'). As subpastas inputs/, state/ e output/ serão criadas dentro dele.",
          },
          uploadsDir: {
            type: "string",
            description:
              "Caminho opcional da pasta contendo os uploads originais do usuário (ex.: 'C:/workspace/.user_uploaded'). Arquivos .docx são copiados e inspecionados imediatamente; PDFs e outros anexos pesados são transferidos em segundo plano sem travar a chamada.",
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
      name: "inspect_docx",
      description:
        "Realiza a engenharia reversa estrutural completa de um arquivo Word (.docx), construindo no topo do JSON o índice estrutural rápido 'toc_map' (seções P..., perguntas/campos de formulário T...R...C... com suggested_target_slot e resumo de tabelas), calculando o 'structure_fingerprint', executando matching 1-para-N contra o cache global (core/registry/templates/) com reancoragem automática (Auto-Offset v0.6.0 gerando adapted_slots_manifest.json em drift 75%-99%), gerando a visão linear compacta de auditoria ('visao_auditoria_<nome>.md' para turno único) e gravando o JSON detalhado com retorno sintético executivo 'toc_summary' (< 1 KB).\n" +
        "- Quando usar (Pré-condição): Deve ser chamada após 'bootstrap_case' para descobrir os índices exatos ou reaproveitar templates do cache global, OU após 'fill_docx_template' sobre o arquivo gerado em output/ para preparar o mapa estrutural e a visão linear para auditoria externa em turno único.\n" +
        "- Pós-condição & Próximo Passo: Grava em disco o mapa estrutural com toc_map e o markdown 'visao_auditoria_<nome>.md'. Se template_match for EXACT ou MODIFIED, utilize o manifesto homologado/adaptado gerado e chame 'build_docx_template'; se NEW, elabore o slots_manifest.json.",
      inputSchema: {
        type: "object",
        required: ["docxPath"],
        properties: {
          docxPath: {
            type: "string",
            description:
              "Caminho absoluto ou relativo do arquivo Word bruto a ser inspecionado (ex.: 'C:/workspace/cases/caso_exemplo/inputs/modelo_etp.docx' ou 'C:/workspace/cases/caso_exemplo/output/ETP_Exemplo.docx').",
          },
          outputPath: {
            type: "string",
            description:
              "Caminho onde o mapa estrutural JSON detalhado será gravado no disco (ex.: 'C:/workspace/cases/caso_exemplo/state/estrutura_etp.json' ou 'C:/workspace/cases/caso_exemplo/state/inspecao_output.json'). Se omitido, salva automaticamente como <docx>_estrutura.json.",
          },
          compact: {
            type: "boolean",
            description:
              "Se true (padrão), omite parágrafos e células vazias no JSON de saída para economizar espaço em disco, preservando intactos os índices originais 0-based e o toc_map.",
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
        "- Quando usar (Pré-condição): Deve ser chamada após 'inspect_docx' e após a elaboração/adaptação do arquivo 'slots_manifest.json'.\n" +
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
        "Injeta os dados de um estado_caso.json em um template Word (.docx) parametrizado com tags {{...}}, com auto-reparo de JSON, desaninhamento automático (unflatten) de chaves com notação de ponto (ex.: 'etp.necessidade'), resolvendo variáveis simples, loops FOR em tabelas, blocos condicionais IF, conversão de quebras \\n em parágrafos reais, negrito seletivo (**texto**) e expansão recursiva de listas multinível (1.1, 1.1.1, etc.).\n" +
        "- Quando usar (Pré-condição): Deve ser chamada após 'build_docx_template' gerar o template e após a elaboração do 'estado_caso.json'.\n" +
        "- Pós-condição & Próximo Passo: Gera a minuta final do documento Word em outputPath. Próximo passo recomendado: para fins de auditoria externa, execute 'inspect_docx' sobre este arquivo gerado em output/ (gerando state/inspecao_output.json) antes de acionar a auditoria e 'generate_audit_docx'.",
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
        "Gera um Relatório de Auditoria Técnico-Jurídica em formato Word (.docx) em layout editorial vertical corrido (folha A4 retrato, zero tabelas <w:tbl>, 100% largura útil), com validação fail-fast estrita (padrão Exact Copy-Paste Error v0.6.2), sanitização automática de crases Markdown, coordenadas e códigos de enum, e transcrição integral de trechos probatórios (trechos_documento) em blocos de citação recuados.\n" +
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
    { name: "docgov-docx-engine", version: VERSION },
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
        description: "Guia Canônico do Ciclo de Vida docgov-docx",
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
        const res = await bootstrapCase(caseDir, uploadsDir, { fileRenameMap });
        const synthetic = formatBootstrapCaseSyntheticResult(res, caseDir);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(synthetic, null, 2),
            },
          ],
        };
      }

      if (toolName === "inspect_docx") {
        const { docxPath, outputPath, compact } = request.params.arguments as {
          docxPath: string;
          outputPath?: string;
          compact?: boolean;
        };
        const resolvedDocx = resolve(docxPath);
        const effectiveOutputPath = outputPath
          ? resolve(outputPath)
          : resolve(
              dirname(resolvedDocx),
              `estrutura_${basename(resolvedDocx, ".docx")}.json`
            );

        const inspection = await inspectDocx(
          resolvedDocx,
          effectiveOutputPath,
          compact !== false
        );

        const synthetic = formatInspectDocxSyntheticResult(
          docxPath,
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
        const result = await buildDocxTemplate(
          sourcePath,
          manifestPath,
          outputPath,
          { saveToRegistry, templateId }
        );
        const synthetic = formatBuildDocxTemplateSyntheticResult(
          outputPath,
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
        const { templatePath, statePath, outputPath } = request.params
          .arguments as {
          templatePath: string;
          statePath: string;
          outputPath: string;
        };
        const result = await processDocument(
          templatePath,
          statePath,
          outputPath
        );
        const nextHint =
          "Próximo passo recomendado: para fins de auditoria externa, execute 'inspect_docx' sobre este arquivo gerado em output/ (gerando state/inspecao_output.json) antes de acionar a auditoria e 'generate_audit_docx'.";
        return {
          content: [{ type: "text", text: `${result.message}\n${nextHint}` }],
        };
      }

      if (toolName === "generate_audit_docx") {
        const { auditJsonPath, outputPath } = request.params.arguments as {
          auditJsonPath: string;
          outputPath: string;
        };
        const result = await generateAuditDocx(auditJsonPath, outputPath);
        const nextHint =
          "Ciclo de auditoria concluído: o parecer em layout vertical A4 (zero tabelas) está pronto em output/ para revisão e assinatura.";
        return {
          content: [{ type: "text", text: `${result.message}\n${nextHint}` }],
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

