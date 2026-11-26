import { describe, test, expect, afterAll } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { isValidDocGovCaseScope } from "../src/utils/paths.ts";
import {
  getEphemeralRootDir,
  isNamedEphemeralSubdir,
  maybeCleanupStaleEphemeralDirs,
} from "../src/utils/ephemeral_scope.ts";
import { formatCompactMcpPath } from "../src/utils/json.ts";
import { inspectDocx, formatInspectDocSyntheticResult } from "../src/tools/inspect.ts";
import { buildDocxTemplate } from "../src/tools/build_template.ts";
import { fillDocxTemplate } from "../src/tools/fill_template.ts";
import { generateAuditDocx } from "../src/tools/audit.ts";
import { generateTechnicalNoteDocx } from "../src/tools/technical_note.ts";
import { governArpExecution } from "../src/arp/govern_arp.ts";
import {
  searchJuris,
  formatSearchJurisSyntheticResult,
  formatFetchJurisSyntheticResult,
  JurisdictionProviderRegistry,
} from "../src/tools/juris/index.ts";
import type { IJurisdictionProvider, RawJurisHit } from "../src/tools/juris/types.ts";
import { createSampleRawDocx } from "./helpers/fixtures.ts";

describe("Blindagem ENG-10, Escopos Efêmeros, inputs/ e Sweep >= 72h (v1.7.4)", () => {
  const tempRoots: string[] = [];

  function makeTempRoot(prefix: string): string {
    const dir = mkdtempSync(join(tmpdir(), `docgov_hardening_${prefix}_`));
    tempRoots.push(dir);
    return dir;
  }

  afterAll(() => {
    for (const d of tempRoots) {
      if (existsSync(d)) rmSync(d, { recursive: true, force: true });
    }
  });

  test("1. A-01: bloqueia path traversal '..' e symlinks apontando para fora do escopo DocGov", () => {
    expect(isValidDocGovCaseScope("cases/x/../../../Windows/System32")).toBe(false);
    expect(isValidDocGovCaseScope("cases/x/../../etc/passwd")).toBe(false);

    const ephRoot = getEphemeralRootDir();
    expect(isValidDocGovCaseScope(ephRoot)).toBe(false);
    expect(isValidDocGovCaseScope(join(ephRoot, "tst_iso_a"))).toBe(false);
    expect(isNamedEphemeralSubdir(ephRoot)).toBe(false);
    expect(isNamedEphemeralSubdir(join(ephRoot, "tst_iso_a"))).toBe(true);

    const outsideTarget = makeTempRoot("sym_target");
    const caseRoot = join(makeTempRoot("sym_case"), "cases", "caso_sym");
    mkdirSync(caseRoot, { recursive: true });
    const symlinkInsideCase = join(caseRoot, "evil_link");
    const symType = process.platform === "win32" ? "junction" : "dir";

    try {
      symlinkSync(outsideTarget, symlinkInsideCase, symType);
      expect(isValidDocGovCaseScope(join(symlinkInsideCase, "saida.docx"))).toBe(false);
    } finally {
      if (existsSync(symlinkInsideCase)) rmSync(symlinkInsideCase, { recursive: true, force: true });
    }
  });

  test("2. A-02: preserva duas subpastas efêmeras nomeadas distintas em searchJuris (bug TST)", async () => {
    const ephRoot = getEphemeralRootDir();
    const tag = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const dirA = join(ephRoot, `tst_iso_a_${tag}`);
    const dirB = join(ephRoot, `tst_iso_b_${tag}`);

    const makeRegistry = (id: string) => {
      const reg = new JurisdictionProviderRegistry();
      const prov: IJurisdictionProvider = {
        courtId: "TST",
        courtName: "TST",
        sphere: "FEDERAL",
        supportsLiveSearch: true,
        async search(): Promise<RawJurisHit[]> {
          return [
            {
              id,
              court: "TST",
              colegiado: "SDI-1",
              numero: "1",
              ano: "2026",
              tese: `Precedente isolado ${id}`,
              dispositivo: "CONHECIDO",
            },
          ];
        },
        async fetch() {
          return { exists: false, rawTextOrJson: "" };
        },
      };
      reg.register(prov);
      return reg;
    };

    try {
      const resA = await searchJuris({ query: "terceirizacao", courts: ["TST"], caseDir: dirA }, makeRegistry("OJ-TST-100"));
      const resB = await searchJuris({ query: "adicional", courts: ["TST"], caseDir: dirB }, makeRegistry("SUMULA-TST-200"));

      expect(dirname(resA.jsonPath)).toBe(resolve(dirA));
      expect(dirname(resB.jsonPath)).toBe(resolve(dirB));
      expect(resA.fileResult.results.map((r) => r.id)).toEqual(["OJ-TST-100"]);
      expect(resB.fileResult.results.map((r) => r.id)).toEqual(["SUMULA-TST-200"]);
      expect(existsSync(join(ephRoot, "juris_search_results.json"))).toBe(false);
    } finally {
      rmSync(dirA, { recursive: true, force: true });
      rmSync(dirB, { recursive: true, force: true });
    }
  });

  test("3. A-03: bloqueia bypass ENG-10 nos 4 compiladores e impede diff_documental em pasta externa", async () => {
    const caseDir = join(makeTempRoot("a03_case"), "cases", "caso_a03");
    const inputsDir = join(caseDir, "inputs");
    const stateDir = join(caseDir, "state");
    mkdirSync(inputsDir, { recursive: true });
    mkdirSync(stateDir, { recursive: true });

    const inScopeDocx = join(inputsDir, "minuta.docx");
    const inScopeJson = join(stateDir, "data.json");
    await createSampleRawDocx(inScopeDocx);
    writeFileSync(inScopeJson, JSON.stringify({ processo_id: "001", resumo_executivo: "ok" }), "utf-8");

    const externalDir = makeTempRoot("a03_ext");
    const externalOutDocx = join(externalDir, "fora.docx");

    await expect(buildDocxTemplate(inScopeDocx, inScopeJson, externalOutDocx)).rejects.toThrow("Operação bloqueada fora de escopo DocGov:");
    await expect(fillDocxTemplate(inScopeDocx, inScopeJson, externalOutDocx)).rejects.toThrow("Operação bloqueada fora de escopo DocGov:");
    await expect(generateAuditDocx(inScopeJson, externalOutDocx)).rejects.toThrow("Operação bloqueada fora de escopo DocGov:");
    await expect(generateTechnicalNoteDocx(inScopeJson, externalOutDocx)).rejects.toThrow("Operação bloqueada fora de escopo DocGov:");

    const extDoc1 = join(externalDir, "v1.docx");
    const extDoc2 = join(externalDir, "v2.docx");
    await createSampleRawDocx(extDoc1);
    await createSampleRawDocx(extDoc2);

    const insp = await inspectDocx(extDoc2, undefined, false, { compareWithPath: extDoc1 });
    try {
      expect(readdirSync(externalDir).some((f) => f.startsWith("diff_documental_"))).toBe(false);
      expect(insp.diff_result?.diff_report_path).toBeDefined();
      expect(insp.diff_result!.diff_report_path!.startsWith(resolve(getEphemeralRootDir()))).toBe(true);
    } finally {
      if (insp.audit_view_path) {
        rmSync(dirname(insp.audit_view_path), { recursive: true, force: true });
      }
    }
  });

  test("4. A-05: formatCompactMcpPath e envelopes MCP nunca emitem '../' para %TEMP%", async () => {
    const ephDir = join(getEphemeralRootDir(), `mcp_path_${Date.now()}`);
    const mdFile = join(ephDir, "juris_search_results.md");
    const dossieFile = join(ephDir, "state", "dossie_juris_tcu_1_2026.md");
    const fullFile = join(ephDir, "state", "juris_tcu_1_2026", "inteiro_teor_anatomico.md");

    const compact = formatCompactMcpPath(mdFile, process.cwd());
    expect(compact).not.toContain("../");
    expect(compact).not.toContain("%TEMP%");
    expect(compact).toBe(resolve(mdFile).replace(/\\/g, "/"));

    const sjPayload = formatSearchJurisSyntheticResult(
      {
        engine_version: "1.7.4",
        timestamp: new Date().toISOString(),
        query: "pregao",
        queries_executed: ["pregao"],
        stance: "NEUTRAL",
        regime: "AUTO",
        total_hits: 1,
        statutory_bridge_applied: [],
        normative_bridge: [],
        jurisdiction_routing: { requested_courts: ["TCU"], executed_courts: ["TCU"] },
        results: [],
      },
      mdFile,
      process.cwd(),
      []
    );
    expect(sjPayload.results_md).not.toContain("../");
    expect(Buffer.byteLength(JSON.stringify(sjPayload), "utf-8")).toBeLessThan(900);

    const fjPayload = formatFetchJurisSyntheticResult(
      {
        slicedResult: {
          dossieMarkdown: "",
          fullMarkdown: "",
          topicsMatched: [],
          layers: {
            layer_1A_metadata: { numero: "1", ano: "2026", colegiado: "Plenario", relator: "Min" },
            layer_1B_entity_regime: { entidade: "ORGAO", regimeLegal: "NAO_APLICAVEL" },
            outcome_summary: "DECISAO",
          } as any,
        },
        dossiePath: dossieFile,
        fullPath: fullFile,
        court: "TCU",
        canonicalId: "ACORDAO-TCU-1-2026-PLENARIO",
      },
      process.cwd()
    );
    expect(fjPayload.dossie_sliced_md).not.toContain("../");
    expect(fjPayload.inteiro_teor_full_md).not.toContain("../");
    expect(Buffer.byteLength(JSON.stringify(fjPayload), "utf-8")).toBeLessThan(900);

    const extDoc = join(makeTempRoot("a05_insp"), "doc.docx");
    await createSampleRawDocx(extDoc);
    const insp = await inspectDocx(extDoc);
    try {
      const inspPayload = formatInspectDocSyntheticResult(extDoc, undefined, insp);
      expect(inspPayload.audit_view_path || "").not.toContain("../");
    } finally {
      if (insp.audit_view_path) rmSync(dirname(insp.audit_view_path), { recursive: true, force: true });
    }
  });

  test("5. A-06: protege inputs/ redirecionando para state/ sem alterar templates/ nem --out explícito", async () => {
    const caseRoot = join(makeTempRoot("a06"), "cases", "caso_inputs");
    const inputsDir = join(caseRoot, "inputs");
    const templatesDir = join(caseRoot, "templates");
    const stateDir = join(caseRoot, "state");
    mkdirSync(inputsDir, { recursive: true });
    mkdirSync(templatesDir, { recursive: true });
    mkdirSync(stateDir, { recursive: true });

    const inputDocx = join(inputsDir, "edital.docx");
    const tplDocx = join(templatesDir, "modelo.docx");
    await createSampleRawDocx(inputDocx);
    await createSampleRawDocx(tplDocx);

    // 1. inputs/ sem outputPath -> redireciona para state/
    const resInput = await inspectDocx(inputDocx);
    expect(dirname(resInput.audit_view_path!)).toBe(resolve(stateDir));
    expect(readdirSync(inputsDir)).toEqual(["edital.docx"]);

    // 2. templates/ sem outputPath -> preserva templates/ (Sub-Assert 28.3)
    const resTpl = await inspectDocx(tplDocx);
    expect(dirname(resTpl.audit_view_path!)).toBe(resolve(templatesDir));

    // 3. --out explícito em inputs/ -> preserva caminho explícito (Sub-Assert 33.3)
    const explicitOut = join(inputsDir, "estrutura_custom.json");
    const resExplicit = await inspectDocx(inputDocx, explicitOut);
    expect(dirname(resExplicit.audit_view_path!)).toBe(resolve(inputsDir));

    // 4. Tool Gen5 com input JSON dentro de inputs/ e sem outputDir -> redireciona para state/
    const arpInput = join(inputsDir, "arp_input.json");
    writeFileSync(
      arpInput,
      JSON.stringify({
        arp_id: "ARP-01/2026",
        process_id: "001",
        legal_regime: "LEI_14133",
        orgao_gerenciador: { nome: "ORGAO_A", esfera: "FEDERAL", regime: "LEI_14133" },
        orgao_aderente: { nome: "ORGAO_B", esfera: "FEDERAL", regime: "LEI_14133" },
        items: [{ item_id: "1", descricao: "Item", quantidade_registrada: 10, quantidade_solicitada: 2, adesoes_previas_total: 0, valor_unitario: 100 }],
      }),
      "utf-8"
    );
    const arpRes = await governArpExecution(arpInput, { compilationMode: "NONE" });
    expect(arpRes.synthetic.dossier_json_path.replace(/\\/g, "/")).toContain("cases/caso_inputs/state/");
    expect(readdirSync(inputsDir).some((f) => f.includes("arp") && f !== "arp_input.json")).toBe(false);
  });

  test("6. A-08: sweep lazy >= 72h respeita .last_sweep (< 12h), preserva excludeDir e não toca locks/cache", () => {
    const ephRoot = getEphemeralRootDir();
    const locksDir = join(tmpdir(), "docgov_locks");
    const jurisCacheDir = join(tmpdir(), "docgov_juris_cache");
    mkdirSync(locksDir, { recursive: true });
    mkdirSync(jurisCacheDir, { recursive: true });

    const staleLockSentinel = join(locksDir, "sentinel_keep.lock");
    const staleCacheSentinel = join(jurisCacheDir, "sentinel_keep.json");
    writeFileSync(staleLockSentinel, "keep", "utf-8");
    writeFileSync(staleCacheSentinel, "{}", "utf-8");

    const oldDir = join(ephRoot, `sweep_old_${Date.now()}`);
    const activeOldDir = join(ephRoot, `sweep_active_${Date.now()}`);
    const freshDir = join(ephRoot, `sweep_fresh_${Date.now()}`);
    mkdirSync(oldDir, { recursive: true });
    mkdirSync(activeOldDir, { recursive: true });
    mkdirSync(freshDir, { recursive: true });

    const nowMs = Date.now();
    const oldTime = new Date(nowMs - 80 * 3600 * 1000);
    utimesSync(oldDir, oldTime, oldTime);
    utimesSync(activeOldDir, oldTime, oldTime);

    const lastSweepPath = join(ephRoot, ".last_sweep");
    if (existsSync(lastSweepPath)) rmSync(lastSweepPath, { force: true });

    try {
      const removed1 = maybeCleanupStaleEphemeralDirs(activeOldDir, {
        nowMs,
        forceResetInProcess: true,
      });
      expect(removed1).toBeGreaterThanOrEqual(1);
      expect(existsSync(oldDir)).toBe(false);
      expect(existsSync(activeOldDir)).toBe(true);
      expect(existsSync(freshDir)).toBe(true);
      expect(existsSync(staleLockSentinel)).toBe(true);
      expect(existsSync(staleCacheSentinel)).toBe(true);

      // Segunda chamada < 12h deve fazer curto-circuito em 1 statSync
      const oldDir2 = join(ephRoot, `sweep_old2_${Date.now()}`);
      mkdirSync(oldDir2, { recursive: true });
      utimesSync(oldDir2, oldTime, oldTime);
      const removed2 = maybeCleanupStaleEphemeralDirs(activeOldDir, {
        nowMs: nowMs + 60_000,
        forceResetInProcess: true,
      });
      expect(removed2).toBe(0);
      expect(existsSync(oldDir2)).toBe(true);
      rmSync(oldDir2, { recursive: true, force: true });
    } finally {
      rmSync(oldDir, { recursive: true, force: true });
      rmSync(activeOldDir, { recursive: true, force: true });
      rmSync(freshDir, { recursive: true, force: true });
      rmSync(staleLockSentinel, { force: true });
      rmSync(staleCacheSentinel, { force: true });
    }
  });
});
