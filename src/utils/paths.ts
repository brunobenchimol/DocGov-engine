import { existsSync, readdirSync, mkdirSync } from "node:fs";
import { resolve, dirname, basename, normalize, isAbsolute, join } from "node:path";
import { tmpdir } from "node:os";

let cachedWorkspaceRoot: string | null = null;

/**
 * Verifica se um caminho é absoluto, considerando tanto padrões POSIX quanto Windows
 * (ex.: C:\..., D:/..., \\server\share, ou /usr/...), independente do SO host.
 */
export function isPathAbsolute(inputPath: string): boolean {
  if (!inputPath) return false;
  return (
    isAbsolute(inputPath) ||
    /^[a-zA-Z]:[\\/]/.test(inputPath) ||
    /^\\\\/.test(inputPath) ||
    inputPath.startsWith("/") ||
    inputPath.startsWith("\\")
  );
}

/**
 * Procura a raiz do workspace do projeto (ex.: DocGov ou docgov-engine)
 * subindo a árvore de diretórios a partir de um ponto inicial.
 */
export function searchAncestorWorkspaceRoot(startDir: string): string | null {
  try {
    let curr = resolve(startDir);
    const root = resolve("/");

    while (curr && curr !== root) {
      // 1. O marcador mais específico de um workspace DocGov completo é a pasta 'cases'
      if (existsSync(join(curr, "cases"))) {
        return curr;
      }
      // 2. Ou a estrutura modular 'core/skills' (presente no repositório DocGov)
      if (existsSync(join(curr, "core", "skills"))) {
        return curr;
      }
      // 3. Ou o repositório docgov-engine (com package.json contendo docgov-engine ou pasta core/registry)
      if (
        existsSync(join(curr, "core", "registry")) ||
        (existsSync(join(curr, "package.json")) && existsSync(join(curr, "src", "index.ts")))
      ) {
        return curr;
      }

      const parent = dirname(curr);
      if (parent === curr) break;
      curr = parent;
    }
  } catch {
    // Retorna null caso ocorra erro de acesso ao sistema de arquivos
  }

  return null;
}

/**
 * Encontra a raiz canônica do workspace do projeto DocGov de forma resiliente,
 * desacoplando a execução de process.cwd() (ex.: quando disparado pelo Antigravity/IDE
 * onde process.cwd() aponta para C:\Users\...\AppData\Local\Programs\antigravity).
 */
export function findWorkspaceRoot(): string {
  if (cachedWorkspaceRoot) {
    return cachedWorkspaceRoot;
  }

  // 1. Variável de ambiente explícita (prioridade máxima)
  if (process.env.DOCGOV_WORKSPACE_DIR && existsSync(process.env.DOCGOV_WORKSPACE_DIR)) {
    cachedWorkspaceRoot = resolve(process.env.DOCGOV_WORKSPACE_DIR);
    return cachedWorkspaceRoot;
  }
  if (process.env.DOCGOV_ROOT_DIR && existsSync(process.env.DOCGOV_ROOT_DIR)) {
    cachedWorkspaceRoot = resolve(process.env.DOCGOV_ROOT_DIR);
    return cachedWorkspaceRoot;
  }

  // 2. Se o binário em execução (process.execPath) estiver ancorado dentro de um repositório DocGov
  // (ex.: <raiz>/core/skills/docgov_engine/bin/docgov-engine.exe)
  if (process.execPath) {
    const fromExec = searchAncestorWorkspaceRoot(dirname(process.execPath));
    if (fromExec && existsSync(join(fromExec, "cases"))) {
      cachedWorkspaceRoot = fromExec;
      return cachedWorkspaceRoot;
    }
  }

  // 3. Se process.argv[1] estiver ancorado em um repositório com 'cases'
  if (process.argv && process.argv[1]) {
    const fromArgv = searchAncestorWorkspaceRoot(dirname(resolve(process.argv[1])));
    if (fromArgv && existsSync(join(fromArgv, "cases"))) {
      cachedWorkspaceRoot = fromArgv;
      return cachedWorkspaceRoot;
    }
  }

  // 4. Se process.cwd() já for o workspace real (e NÃO for pasta interna de IDE/AppData)
  const cwdIsIdeDir = /antigravity|programs|appdata|node_modules|\.cache/i.test(process.cwd());
  const cwdCandidate = searchAncestorWorkspaceRoot(process.cwd());
  if (cwdCandidate && !cwdIsIdeDir) {
    cachedWorkspaceRoot = cwdCandidate;
    return cachedWorkspaceRoot;
  }

  // 5. Tenta a partir do binário geral (mesmo sem pasta 'cases', ex.: no repo standalone docgov-engine)
  if (process.execPath) {
    const fromExec = searchAncestorWorkspaceRoot(dirname(process.execPath));
    if (fromExec) {
      cachedWorkspaceRoot = fromExec;
      return cachedWorkspaceRoot;
    }
  }

  // 6. Tenta a partir de argv[1]
  if (process.argv && process.argv[1]) {
    const fromArgv = searchAncestorWorkspaceRoot(dirname(resolve(process.argv[1])));
    if (fromArgv) {
      cachedWorkspaceRoot = fromArgv;
      return cachedWorkspaceRoot;
    }
  }

  // 7. Se cwdCandidate foi encontrado (mesmo em pasta suspeita)
  if (cwdCandidate) {
    cachedWorkspaceRoot = cwdCandidate;
    return cachedWorkspaceRoot;
  }

  // Fallback seguro: process.cwd()
  cachedWorkspaceRoot = resolve(process.cwd());
  return cachedWorkspaceRoot;
}

/**
 * Limpa o cache da raiz do workspace (útil para testes unitários).
 */
export function resetWorkspaceRootCache(): void {
  cachedWorkspaceRoot = null;
}

/**
 * Resolve resiliência entre Unicode NFC (Windows/Linux) e NFD (macOS APFS/HFS+).
 * Se o caminho exato não existir no disco, procura no diretório pai um arquivo
 * cujo nome normalizado em NFC seja idêntico ao alvo normalizado em NFC.
 */
export function resolveExistingPathNfc(candidatePath: string): string {
  if (!candidatePath) return candidatePath;
  if (existsSync(candidatePath)) return candidatePath;
  try {
    const dir = dirname(candidatePath);
    if (!existsSync(dir)) return candidatePath;
    const targetNfc = basename(candidatePath).normalize("NFC");
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (entry.normalize("NFC") === targetNfc) {
        return join(dir, entry);
      }
    }
  } catch {
    // Fallback seguro para o caminho original
  }
  return candidatePath;
}

/**
 * Resolve qualquer caminho fornecido pelo agente ou cliente MCP:
 * - Se for absoluto, normaliza e retorna diretamente (com fallback NFC/NFD);
 * - Se for relativo, resolve contra a raiz do workspace detectada
 *   (e nunca contra pastas de instalação da IDE como AppData\Local\Programs\antigravity).
 */
export function resolveWorkspacePath(inputPath: string, customRoot?: string): string {
  if (!inputPath) return inputPath;
  if (isPathAbsolute(inputPath)) {
    return resolveExistingPathNfc(normalize(inputPath));
  }

  if (customRoot) {
    return resolveExistingPathNfc(resolve(customRoot, inputPath));
  }

  const cwdIsIdeDir = /antigravity|programs|appdata|node_modules|\.cache/i.test(process.cwd());
  const cleanRelative = inputPath.replace(/^\.[\\/]+/, "");

  // 1. Se o input for explicitamente o diretório atual ('.' ou './' ou '.\')
  if (inputPath === "." || cleanRelative === "") {
    if (!cwdIsIdeDir) {
      return resolve(process.cwd());
    }
  }

  // 2. Se for relativo sem prefixo 'cases/' e o CWD não for a IDE (ex.: './uploads', 'inputs/doc.docx')
  const hasCasesPrefix = /^cases([\\/]|$)/i.test(cleanRelative);
  if (!hasCasesPrefix && !cwdIsIdeDir) {
    return resolveExistingPathNfc(resolve(process.cwd(), inputPath));
  }

  const root = findWorkspaceRoot();
  return resolveExistingPathNfc(resolve(root, inputPath));
}

/**
 * Validador canônico de escopo do ecossistema DocGov (ENG-10).
 * Considera válido apenas caminhos pertencentes a casos ('cases/<slug>')
 * ou diretórios estruturais/harnesses de certificação e teste.
 */
export function isValidDocGovCaseScope(targetPath: string): boolean {
  if (!targetPath) return false;
  const normalized = targetPath.replace(/\\/g, "/");
  return /(^|[\\/])(cases|work|evals|inputs|state|output|templates|fixtures|DocGov\.EngineTests|case_assert|docgov_test_[^\\/]*)([\\/]|$)/i.test(
    normalized
  );
}

/**
 * Bloqueio Fail-Fast para ferramentas de processo executadas fora de um caso DocGov válido (ENG-10).
 */
export function assertDocGovCaseScope(targetPath: string, toolName?: string): void {
  if (!isValidDocGovCaseScope(targetPath)) {
    throw new Error(
      `Operação bloqueada fora de escopo DocGov: '${targetPath}' não pertence a um diretório de caso 'cases/<slug>/'. Esta ferramenta é exclusiva para instrução processual dentro do ecossistema DocGov.`
    );
  }
}

/**
 * Retorna o diretório efêmero isolado em %TEMP% para ferramentas autorizadas fora de escopo (inspect_doc / search_pncp).
 */
export function getEphemeralInspectDir(): string {
  const ephemeralDir = join(tmpdir(), "docgov_ephemeral_inspect");
  if (!existsSync(ephemeralDir)) {
    mkdirSync(ephemeralDir, { recursive: true });
  }
  return ephemeralDir;
}

