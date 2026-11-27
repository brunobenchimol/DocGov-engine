import { afterAll, afterEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_MCP_INLINE_MAX_BYTES,
  DEFAULT_MCP_POINTER_MAX_BYTES,
  MCP_INLINE_HINT,
  MCP_POINTER_HINT,
  getMcpInlineMaxBytes,
  getMcpPointerMaxBytes,
} from "../src/config/mcp_limits.ts";
import { flushPendingWrites } from "../src/utils/fs_safe_io.ts";
import {
  buildHybridMcpEnvelope,
  buildSummaryMcpEnvelope,
  computeMarkdownMetrics,
  normalizeMarkdownForMcp,
} from "../src/utils/mcp_hybrid_output.ts";

describe("MCP Híbrido 8 KB & Lei 2 Bimodal (mcp_limits + mcp_hybrid_output)", () => {
  const tempDirs: string[] = [];
  const origInlineEnv = process.env.MCP_INLINE_MAX_BYTES;
  const origPointerEnv = process.env.MCP_POINTER_MAX_BYTES;

  function makeTempDir(prefix: string): string {
    const dir = mkdtempSync(join(tmpdir(), `docgov_hybrid_${prefix}_`));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    if (origInlineEnv === undefined) {
      delete process.env.MCP_INLINE_MAX_BYTES;
    } else {
      process.env.MCP_INLINE_MAX_BYTES = origInlineEnv;
    }
    if (origPointerEnv === undefined) {
      delete process.env.MCP_POINTER_MAX_BYTES;
    } else {
      process.env.MCP_POINTER_MAX_BYTES = origPointerEnv;
    }
  });

  afterAll(async () => {
    await flushPendingWrites();
    for (const d of tempDirs) {
      if (existsSync(d)) {
        rmSync(d, { recursive: true, force: true });
      }
    }
  });

  test("1. Fronteira exata UTF-8 com acentuação: <= 8192 B retorna INLINE; 8193 B retorna POINTER síncrono", async () => {
    expect(getMcpInlineMaxBytes()).toBe(DEFAULT_MCP_INLINE_MAX_BYTES);
    expect(getMcpPointerMaxBytes()).toBe(DEFAULT_MCP_POINTER_MAX_BYTES);

    const dir = makeTempDir("boundary");
    const primaryPath = join(dir, "state", "dossie_teste.md");
    const companionPath = join(dir, "state", "companion_teste.md");
    const basePayload = {
      status: "success",
      engine_version: "1.7.5",
      dossie_path: "state/dossie_teste.md",
    };

    // Descobre o tamanho exato de padding para atingir 8192 bytes UTF-8 exatos
    const seedMd = "\uFEFF# Dossiê Técnico — Licitação & Contratação nº 10\r\n";
    const probe = await buildHybridMcpEnvelope({
      basePayload,
      artifactPath: primaryPath,
      displayArtifactPath: "state/dossie_teste.md",
      markdownContent: seedMd,
      writeMode: "sync",
    });
    const probeBytes = Buffer.byteLength(probe.json, "utf8");
    const neededBytes = 8192 - probeBytes;
    expect(neededBytes).toBeGreaterThan(100);

    // Preenche com caracteres ASCII + acentuados multi-byte ("ç" = 2 bytes UTF-8)
    const accentBlock = "çãé"; // 6 bytes UTF-8, 3 chars
    const repeatCount = Math.floor((neededBytes - 6) / 6);
    const remBytes = neededBytes - repeatCount * 6;
    const exactMd = seedMd + accentBlock.repeat(repeatCount) + "a".repeat(remBytes);

    const exactRes = await buildHybridMcpEnvelope({
      basePayload,
      artifactPath: primaryPath,
      displayArtifactPath: "state/dossie_teste.md",
      markdownContent: exactMd,
      writeMode: "write_behind",
      deferWrite: true,
      companionWrites: [{ filePath: companionPath, content: "# Companion\r\nOK" }],
    });

    const exactJsonBytes = Buffer.byteLength(exactRes.json, "utf8");
    expect(exactJsonBytes).toBe(8192);
    expect(exactRes.delivery_mode).toBe("INLINE");
    expect(exactRes.payload.delivery_mode).toBe("INLINE");
    expect(exactRes.payload.read_file_required).toBe(false);
    expect(exactRes.payload.next_step_hint).toBe(MCP_INLINE_HINT);
    expect(exactRes.payload.artifact_path).toBe("state/dossie_teste.md");
    expect(exactRes.payload.inline_markdown).toBe(normalizeMarkdownForMcp(exactMd));
    expect(exactRes.payload.artifact_lines).toBe(
      computeMarkdownMetrics(normalizeMarkdownForMcp(exactMd)).artifact_lines
    );

    await flushPendingWrites();
    expect(readFileSync(primaryPath, "utf8")).toBe(normalizeMarkdownForMcp(exactMd));
    expect(readFileSync(companionPath, "utf8")).toBe("# Companion\nOK");

    // +1 byte UTF-8 -> 8193 B => POINTER obrigatório com gravação síncrona imediata
    const dirOver = makeTempDir("boundary_over");
    const overPrimary = join(dirOver, "state", "dossie_over.md");
    const overCompanion = join(dirOver, "state", "companion_over.md");
    const overMd = exactMd + "x";

    const overRes = await buildHybridMcpEnvelope({
      basePayload,
      artifactPath: overPrimary,
      displayArtifactPath: "state/dossie_teste.md",
      markdownContent: overMd,
      writeMode: "write_behind",
      deferWrite: true,
      companionWrites: [
        { filePath: overCompanion, content: "# Companheiro síncrono\r\nLinha 2" },
      ],
    });

    expect(overRes.delivery_mode).toBe("POINTER");
    expect(overRes.payload.delivery_mode).toBe("POINTER");
    expect(overRes.payload.read_file_required).toBe(true);
    expect(overRes.payload.next_step_hint).toBe(MCP_POINTER_HINT);
    expect(overRes.payload.inline_markdown).toBeUndefined();
    expect(Buffer.byteLength(overRes.json, "utf8")).toBeLessThanOrEqual(
      DEFAULT_MCP_POINTER_MAX_BYTES
    );

    // Sem chamar flushPendingWrites(): em POINTER ambos já devem estar no disco!
    expect(existsSync(overPrimary)).toBe(true);
    expect(existsSync(overCompanion)).toBe(true);
    expect(readFileSync(overPrimary, "utf8")).toBe(normalizeMarkdownForMcp(overMd));
    expect(readFileSync(overCompanion, "utf8")).toBe("# Companheiro síncrono\nLinha 2");
  });

  test("2. Override via MCP_INLINE_MAX_BYTES=2048 força modo POINTER", async () => {
    process.env.MCP_INLINE_MAX_BYTES = "2048";
    expect(getMcpInlineMaxBytes()).toBe(2048);

    const dir = makeTempDir("override");
    const mdPath = join(dir, "state", "visao.md");
    const md = "# Seção Única\n" + "Texto jurídico determinístico com acentuação. ".repeat(60);

    const res = await buildHybridMcpEnvelope({
      basePayload: { status: "success", engine_version: "1.7.5" },
      artifactPath: mdPath,
      displayArtifactPath: "state/visao.md",
      markdownContent: md,
      writeMode: "write_behind",
    });

    expect(res.delivery_mode).toBe("POINTER");
    expect(res.payload.read_file_required).toBe(true);
    expect(res.payload.inline_markdown).toBeUndefined();
    expect(existsSync(mdPath)).toBe(true);
  });

  test("3. Modo SUMMARY para compiladores binários (read_file_required: false, < 1024 B)", () => {
    const res = buildSummaryMcpEnvelope({
      status: "success",
      engine_version: "1.7.5",
      outputPath: "output/Relatorio_Auditoria.docx",
      pdf_path: "output/Relatorio_Auditoria.pdf",
      message: "Relatório gerado com sucesso.",
      next_step_hint: "Parecer pronto em output/.",
    });

    expect(res.delivery_mode).toBe("SUMMARY");
    expect(res.payload.delivery_mode).toBe("SUMMARY");
    expect(res.payload.read_file_required).toBe(false);
    expect(res.payload.inline_markdown).toBeUndefined();
    expect(Buffer.byteLength(res.json, "utf8")).toBeLessThan(1024);
  });

  test("4. Modo POINTER preserva sentinela [+N_TAGS_NO_DOSSIE] e respeita <= 880 B no JSON final", async () => {
    process.env.MCP_INLINE_MAX_BYTES = "512";
    const dir = makeTempDir("tags_overflow");
    const mdPath = join(dir, "dossie_estresse.md");

    const manyTags = Array.from(
      { length: 24 },
      (_, idx) => `[BLOCKING_TAG_EXCEEDED_VERY_LONG_RULE_${idx + 1}]`
    );

    const res = await buildHybridMcpEnvelope({
      basePayload: {
        status: "NAO_CONFORME",
        engine_version: "1.7.5",
        case_id: "PROC-ESTRESSE-2026-001",
        blocking_tags: manyTags,
        md_path: "state/dossie_estresse.md",
        json_path: "state/dossie_estresse.json",
      },
      artifactPath: mdPath,
      displayArtifactPath: "state/dossie_estresse.md",
      markdownContent: "# Dossiê Completo\n" + "Linha de análise pericial.\n".repeat(40),
      writeMode: "write_behind",
    });

    expect(res.delivery_mode).toBe("POINTER");
    expect(res.payload.read_file_required).toBe(true);
    expect(res.payload.artifact_path).toBe("state/dossie_estresse.md");
    expect(res.payload.md_path).toBe("state/dossie_estresse.md");
    expect(Buffer.byteLength(res.json, "utf8")).toBeLessThanOrEqual(880);
    expect(
      res.payload.blocking_tags.some((t: string) => /^\[\+\d+_TAGS_NO_DOSSIE\]$/.test(t))
    ).toBe(true);
  });

  test("5. Erro em write-behind é isolado em stderr (zero stdout, zero UnhandledPromiseRejection)", async () => {
    const dir = makeTempDir("wb_err");
    // Cria um arquivo regular e tenta gravar um filho dentro dele (ENOTDIR garantido)
    const blockerFile = join(dir, "arquivo_nao_diretorio");
    writeFileSync(blockerFile, "ocupado", "utf8");
    const invalidChildPath = join(blockerFile, "filho.md");

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    const origStdoutWrite = process.stdout.write.bind(process.stdout);
    const origStderrWrite = process.stderr.write.bind(process.stderr);

    let unhandledCount = 0;
    const onUnhandled = () => {
      unhandledCount++;
    };
    process.on("unhandledRejection", onUnhandled);

    (process.stdout as any).write = (chunk: any) => {
      stdoutChunks.push(String(chunk));
      return true;
    };
    (process.stderr as any).write = (chunk: any) => {
      stderrChunks.push(String(chunk));
      return true;
    };

    try {
      const res = await buildHybridMcpEnvelope({
        basePayload: { status: "success", engine_version: "1.7.5" },
        artifactPath: invalidChildPath,
        displayArtifactPath: "state/filho.md",
        markdownContent: "# Teste de Erro Assíncrono\nConteúdo pequeno.",
        writeMode: "write_behind",
        deferWrite: true,
      });
      expect(res.delivery_mode).toBe("INLINE");
      await flushPendingWrites();
      await new Promise((r) => setTimeout(r, 20));
    } finally {
      (process.stdout as any).write = origStdoutWrite;
      (process.stderr as any).write = origStderrWrite;
      process.off("unhandledRejection", onUnhandled);
    }

    expect(stdoutChunks.join("")).toBe("");
    expect(stderrChunks.join("")).toContain("[docgov-engine][write-behind]");
    expect(unhandledCount).toBe(0);
  });
});
