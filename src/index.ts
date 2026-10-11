import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createReport } from "docx-templates";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

export const VERSION = "0.0.3";

// --- Função Central de Injeção ---
export async function processDocument(
  templatePath: string,
  statePath: string,
  outputPath: string
): Promise<{ success: boolean; message: string }> {
  const resolvedTemplate = resolve(templatePath);
  const resolvedState = resolve(statePath);
  const resolvedOutput = resolve(outputPath);

  if (!existsSync(resolvedTemplate)) {
    throw new Error(`Template não encontrado: ${resolvedTemplate}`);
  }
  if (!existsSync(resolvedState)) {
    throw new Error(`Arquivo de dados/estado não encontrado: ${resolvedState}`);
  }

  const templateBuffer = readFileSync(resolvedTemplate);
  const stateData = JSON.parse(readFileSync(resolvedState, "utf-8"));

  const outputBuffer = await createReport({
    template: templateBuffer,
    data: stateData,
    cmdDelimiter: ["{{", "}}"],
    noSandbox: true,
  });

  writeFileSync(resolvedOutput, Buffer.from(outputBuffer));
  return {
    success: true,
    message: `Documento gerado com sucesso em: ${resolvedOutput}`,
  };
}

// --- Modo MCP Server ---
async function runMcpServer() {
  const server = new Server(
    { name: "docgov-docx-engine", version: VERSION },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "fill_docx_template",
          description:
            "Preenche um modelo Word (.docx) substituindo variáveis e tabelas com base no JSON de estado do processo, gerando uma minuta limpa sem código residual.",
          inputSchema: {
            type: "object",
            required: ["templatePath", "statePath", "outputPath"],
            properties: {
              templatePath: {
                type: "string",
                description: "Caminho do arquivo modelo .docx",
              },
              statePath: {
                type: "string",
                description: "Caminho do arquivo estado_caso.json",
              },
              outputPath: {
                type: "string",
                description: "Caminho onde o .docx final gerado será salvo",
              },
            },
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "fill_docx_template") {
      const { templatePath, statePath, outputPath } = request.params
        .arguments as {
        templatePath: string;
        statePath: string;
        outputPath: string;
      };

      try {
        const result = await processDocument(templatePath, statePath, outputPath);
        return {
          content: [{ type: "text", text: result.message }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Falha ao gerar documento: ${err.message}` }],
        };
      }
    }
    throw new Error(`Ferramenta desconhecida: ${request.params.name}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// --- Modo CLI ---
async function runCli(args: string[]) {
  if (args.includes("--version") || args.includes("-v")) {
    console.log(`docgov-docx-engine v${VERSION}`);
    return;
  }

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
DocGov Docx Engine v${VERSION} — CLI & MCP Server

Uso:
  docgov-docx                                     Inicia como servidor MCP via stdio (padrão)
  docgov-docx --mcp                               Inicia como servidor MCP via stdio
  docgov-docx --inject --template <arq.docx> --state <estado.json> --out <saida.docx>
  docgov-docx -v, --version                       Exibe a versão do software
  docgov-docx -h, --help                          Exibe esta mensagem de ajuda
`);
    return;
  }

  const templateIdx = args.indexOf("--template");
  const stateIdx = args.indexOf("--state");
  const outIdx = args.indexOf("--out");

  if (templateIdx === -1 || stateIdx === -1 || outIdx === -1) {
    console.error("Erro: Parâmetros obrigatórios ausentes: --template, --state e --out.");
    process.exit(1);
  }

  try {
    const res = await processDocument(args[templateIdx + 1], args[stateIdx + 1], args[outIdx + 1]);
    console.log(res.message);
  } catch (err: any) {
    console.error(`Erro: ${err.message}`);
    process.exit(1);
  }
}

// --- Entrada Principal ---
if (import.meta.main) {
  const args = process.argv.slice(2);

  // Se tiver flag explícita de CLI (--inject, --template, --help, -h, --version, -v), roda CLI.
  // Caso contrário (sem args ou com --mcp), sobe como MCP server imediatamente.
  if (
    args.includes("--inject") ||
    args.includes("--template") ||
    args.includes("--help") ||
    args.includes("-h") ||
    args.includes("--version") ||
    args.includes("-v")
  ) {
    runCli(args);
  } else {
    runMcpServer();
  }
}

