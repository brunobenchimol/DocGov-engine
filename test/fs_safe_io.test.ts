import { describe, test, expect, afterAll } from "bun:test";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  enqueueWrite,
  flushPendingWrites,
  getDocGovLocksDir,
  normalizePathKey,
  withDirectoryLock,
  writeFileSafeAsync,
  writeFileSafeSync,
} from "../src/utils/fs_safe_io.ts";
import { searchPncpContracts } from "../src/tools/pncp.ts";
import { searchJuris, JurisdictionProviderRegistry } from "../src/tools/juris/index.ts";
import type { IJurisdictionProvider, RawJurisHit } from "../src/tools/juris/types.ts";

describe("Camada Universal de I/O (fs_safe_io) & Concorrência (v1.7.4)", () => {
  const tempDirs: string[] = [];

  function makeTempCaseDir(prefix: string): string {
    const dir = mkdtempSync(join(tmpdir(), `docgov_test_${prefix}_`));
    tempDirs.push(dir);
    return dir;
  }

  afterAll(() => {
    for (const d of tempDirs) {
      if (existsSync(d)) {
        rmSync(d, { recursive: true, force: true });
      }
    }
  });

  test("1. writeFileSafeSync/Async: remove BOM UTF-8, normaliza CRLF->LF e cria pastas", async () => {
    const baseDir = makeTempCaseDir("io_norm");
    const syncPath = join(baseDir, "nested", "a.txt");
    const asyncPath = join(baseDir, "nested", "b.txt");

    writeFileSafeSync(syncPath, "\uFEFFlinha1\r\nlinha2\rlinha3");
    await writeFileSafeAsync(asyncPath, "\uFEFFalfa\r\nbeta");

    const syncBuf = readFileSync(syncPath);
    const asyncBuf = readFileSync(asyncPath);
    expect(syncBuf.subarray(0, 3).toString("hex")).not.toBe("efbbbf");
    expect(syncBuf.toString("utf-8")).toBe("linha1\nlinha2\nlinha3");
    expect(asyncBuf.toString("utf-8")).toBe("alfa\nbeta");
  });

  test("2. withDirectoryLock: grava lockfile exclusivamente em %TEMP%/docgov_locks e nunca na pasta alvo", async () => {
    const targetDir = makeTempCaseDir("io_lock_target");
    let sawLockInTemp = false;

    await withDirectoryLock(targetDir, "unit_test", async () => {
      const locksDir = getDocGovLocksDir();
      const lockFiles = readdirSync(locksDir).filter((f) => f.endsWith("_unit_test.lock"));
      sawLockInTemp = lockFiles.length >= 1;
      expect(readdirSync(targetDir)).toEqual([]);
      writeFileSafeSync(join(targetDir, "data.txt"), "ok");
    });

    expect(sawLockInTemp).toBe(true);
    expect(readdirSync(targetDir)).toEqual(["data.txt"]);
  });

  test("3. enqueueWrite + flushPendingWrites: serializa escritas em ordem por caminho normalizado", async () => {
    const baseDir = makeTempCaseDir("io_queue");
    const target = join(baseDir, "seq.txt");

    void enqueueWrite(target, "primeiro");
    void enqueueWrite(target, "segundo");
    void enqueueWrite(target, "terceiro");
    await flushPendingWrites();

    expect(readFileSync(target, "utf-8")).toBe("terceiro");
    expect(normalizePathKey(target)).toBe(
      process.platform === "win32" ? resolve(target).toLowerCase() : resolve(target)
    );
  });

  test("4. Concorrência paralela em searchPncpContracts preserva 100% dos candidatos sem perda", async () => {
    const caseDir = join(makeTempCaseDir("pncp_conc"), "cases", "conc_pncp");
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const q = new URL(req.url).searchParams.get("q") || "q";
        const seq = q === "alpha" ? 101 : 202;
        return new Response(
          JSON.stringify({
            items: [
              {
                orgao_cnpj: "00000000000100",
                ano: 2026,
                numero_sequencial: seq,
                orgao_nome: "ORGAO_CONTRATANTE",
                modalidade_licitacao_nome: "Pregão Eletrônico",
                title: `Objeto ${q}`,
                description: `Descrição ${q}`,
                valor_global: 50000,
                data_publicacao_pncp: "2026-04-01T00:00:00",
                uf: "DF",
              },
            ],
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      },
    });

    try {
      await Promise.all([
        searchPncpContracts(caseDir, "alpha", {
          limit: 1,
          baseUrl: `http://127.0.0.1:${server.port}`,
        }),
        searchPncpContracts(caseDir, "beta", {
          limit: 1,
          baseUrl: `http://127.0.0.1:${server.port}`,
        }),
      ]);

      const stateDir = join(caseDir, "state");
      const files = readdirSync(stateDir);
      expect(files.some((f) => f.endsWith(".lock"))).toBe(false);

      const saved = JSON.parse(readFileSync(join(stateDir, "pncp_search_results.json"), "utf-8"));
      expect(saved.total_candidates).toBe(2);
    } finally {
      server.stop(true);
    }
  });

  test("5. Concorrência paralela em searchJuris acumula rodadas sem gravar .lock na pasta do caso", async () => {
    const caseDir = join(makeTempCaseDir("juris_conc"), "cases", "conc_juris");
    const mockProvider: IJurisdictionProvider = {
      courtId: "TCU",
      courtName: "TCU",
      sphere: "FEDERAL",
      supportsLiveSearch: true,
      async search(query: string): Promise<RawJurisHit[]> {
        return [
          {
            id: query === "q1" ? "ACORDAO-TCU-1-2026" : "ACORDAO-TCU-2-2026",
            court: "TCU",
            colegiado: "Plenário",
            numero: query === "q1" ? "1" : "2",
            ano: "2026",
            tese: `Tese para ${query} em licitações públicas`,
            dispositivo: "DAR PROVIMENTO",
          },
        ];
      },
      async fetch() {
        return { exists: false, rawTextOrJson: "" };
      },
    };

    const registry = new JurisdictionProviderRegistry();
    registry.register(mockProvider);

    await Promise.all([
      searchJuris({ query: "q1", courts: ["TCU"], caseDir }, registry),
      searchJuris({ query: "q2", courts: ["TCU"], caseDir }, registry),
    ]);

    const stateDir = join(caseDir, "state");
    expect(readdirSync(stateDir).some((f) => f.endsWith(".lock"))).toBe(false);
    const saved = JSON.parse(readFileSync(join(stateDir, "juris_search_results.json"), "utf-8"));
    expect(saved.total_accumulated).toBe(2);
    expect(saved.queries_executed.length).toBe(2);
  });
});
