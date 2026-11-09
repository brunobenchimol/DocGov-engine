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
  getMcpPromptsDefinition,
  getMcpToolsDefinition,
} from "./tools_definition.ts";
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
import {
  fetchPncpContract,
  formatFetchPncpSyntheticResult,
  searchPncpContracts,
  formatSearchPncpSyntheticResult,
} from "../tools/pncp.ts";
import {
  compileDefenseCounterReasoningDocx,
  compileAttackChallengeDocx,
} from "../tools/juris/index.ts";
import { dispatchModularTool } from "./tool_dispatchers.ts";
import { computeStructuralDiff } from "../core/structural_diff.ts";
import { safeReadJsonFile } from "../utils/json.ts";
import {
  resolveWorkspacePath,
  isValidDocGovCaseScope,
  getEphemeralInspectDir,
} from "../utils/paths.ts";

export { getMcpPromptsDefinition, getMcpToolsDefinition } from "./tools_definition.ts";

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
    return await handleCallToolRequest(request as any);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export async function handleCallToolRequest(request: {
  params: { name: string; arguments?: Record<string, any> };
}) {
  const toolName = request.params.name;

  try {
    if (toolName === "bootstrap_case") {
      const { caseDir, uploadsDir, fileRenameMap } = (request.params
        .arguments || {}) as {
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
        throw new Error("Parâmetro obrigatório 'filePath' não fornecido.");
      }
      const resolvedPath = resolveWorkspacePath(rawPath);
      const resolvedOutput = args.outputPath ? resolveWorkspacePath(args.outputPath) : undefined;
      const resolvedCompare = args.compareWithPath ? resolveWorkspacePath(args.compareWithPath) : undefined;
      const res = await inspectDoc(resolvedPath, resolvedOutput, args.compact ?? true, {
        compareWithPath: resolvedCompare,
      });
      const synthetic = formatInspectDocSyntheticResult(resolvedPath, resolvedOutput, res);
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
        const { sourcePath, manifestPath, outputPath, saveToRegistry, templateId } =
          request.params.arguments as {
            sourcePath: string;
            manifestPath: string;
            outputPath: string;
            saveToRegistry?: boolean;
            templateId?: string;
          };
        const resolvedSource = resolveWorkspacePath(sourcePath);
        const resolvedManifest = resolveWorkspacePath(manifestPath);
        const resolvedOutput = resolveWorkspacePath(outputPath);
        const res = await buildDocxTemplate(resolvedSource, resolvedManifest, resolvedOutput, {
          saveToRegistry,
          templateId,
        });
        const synthetic = formatBuildDocxTemplateSyntheticResult(resolvedOutput, res);
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
        const { templatePath, statePath, outputPath, autoInspect, outputFormat } =
          request.params.arguments as {
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

        const rawData = safeReadJsonFile(resolvedAuditJson);
        if (rawData?.document_type === "BID_CHALLENGE_REPRESENTATION") {
          const res = await compileAttackChallengeDocx(rawData, resolvedOutput, { outputFormat });
          return {
            content: [{ type: "text", text: JSON.stringify({ status: "success", outputPath: res.outputPath, pdf_path: res.pdf_path, message: res.message }, null, 2) }],
          };
        }

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
          const rawNoteData = safeReadJsonFile(resolveWorkspacePath(noteJsonPath));
          if (rawNoteData?.document_type === "LEGAL_COUNTER_REASONING") {
            const res = await compileDefenseCounterReasoningDocx(rawNoteData, resolvedOutput, { outputFormat });
            return {
              content: [{ type: "text", text: JSON.stringify({ status: "success", outputPath: res.outputPath, pdf_path: res.pdf_path, message: res.message }, null, 2) }],
            };
          }

          result = await generateTechnicalNoteDocx(
            rawNoteData || resolveWorkspacePath(noteJsonPath),
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

      if (toolName === "fetch_pncp") {
        const { caseDir, pncpIdOrUrl, shortname } = request.params
          .arguments as {
          caseDir: string;
          pncpIdOrUrl: string;
          shortname?: string;
        };

        if (!caseDir) {
          throw new Error(
            "Parâmetro obrigatório 'caseDir' não fornecido para fetch_pncp."
          );
        }
        if (!pncpIdOrUrl) {
          throw new Error(
            "Parâmetro obrigatório 'pncpIdOrUrl' não fornecido para fetch_pncp."
          );
        }

        const resolvedCaseDir = resolveWorkspacePath(caseDir);
        const result = await fetchPncpContract(resolvedCaseDir, pncpIdOrUrl, {
          shortname,
        });
        const synthetic = formatFetchPncpSyntheticResult(result);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(synthetic, null, 2),
            },
          ],
        };
      }

      if (toolName === "search_pncp") {
        const { caseDir, query, status, uf, modalidade, limit } = request
          .params.arguments as {
          caseDir: string;
          query: string | string[];
          status?: "todas" | "recebendo_proposta" | "encerradas";
          uf?: string;
          modalidade?: string;
          limit?: number;
        };

        if (!caseDir) {
          throw new Error(
            "Parâmetro obrigatório 'caseDir' não fornecido para search_pncp."
          );
        }
        if (!query) {
          throw new Error(
            "Parâmetro obrigatório 'query' não fornecido para search_pncp."
          );
        }

        const resolvedCaseDir = resolveWorkspacePath(caseDir);
        const result = await searchPncpContracts(resolvedCaseDir, query, {
          status,
          uf,
          modalidade,
          limit,
        });
        const synthetic = formatSearchPncpSyntheticResult(result);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(synthetic, null, 2),
            },
          ],
        };
      }

      const modularRes = await dispatchModularTool(toolName, request.params.arguments || {});
      if (modularRes) {
        return modularRes;
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
}

export async function handleCallTool(
  toolName: string,
  toolArgs: Record<string, any> = {}
) {
  return handleCallToolRequest({
    params: { name: toolName, arguments: toolArgs },
  });
}
