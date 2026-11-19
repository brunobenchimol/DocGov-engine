import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { GITHUB_REPO } from "../src/constants/index.ts";

export interface ExtractedReleaseNotes {
  version: string;
  tag: string;
  previousTag: string | null;
  date: string | null;
  subtitle: string | null;
  title: string;
  body: string;
  found: boolean;
}

interface ParsedVersionHeader {
  version: string;
  date: string | null;
  subtitle: string | null;
  lineIndex: number;
}

const VERSION_HEADER_RE =
  /^## \[(\d+\.\d+\.\d+)\](?:\s*-\s*(\d{4}-\d{2}-\d{2}))?(?:\s*(?:—|--|-)\s*(.+))?\s*$/;

function parseVersionHeaders(lines: string[]): ParsedVersionHeader[] {
  const headers: ParsedVersionHeader[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(VERSION_HEADER_RE);
    if (!match) continue;
    headers.push({
      version: match[1],
      date: match[2] ?? null,
      subtitle: match[3] ? match[3].trim() : null,
      lineIndex: i,
    });
  }
  return headers;
}

function trimEdgeBlankAndDividerLines(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && (lines[start].trim() === "" || lines[start].trim() === "---")) {
    start++;
  }
  while (end > start && (lines[end - 1].trim() === "" || lines[end - 1].trim() === "---")) {
    end--;
  }
  return lines.slice(start, end);
}

/**
 * Extrai título e Release Notes formatadas de uma versão específica do CHANGELOG.md.
 */
export function extractReleaseNotesFromChangelog(
  changelogContent: string,
  tagOrVersion: string,
  options?: { repo?: string }
): ExtractedReleaseNotes {
  const normalizedVersion = tagOrVersion.trim().replace(/^v/i, "");
  const tag = `v${normalizedVersion}`;
  const repo = options?.repo ?? GITHUB_REPO;

  const lines = changelogContent.replace(/\r\n/g, "\n").split("\n");
  const headers = parseVersionHeaders(lines);
  const targetIdx = headers.findIndex((h) => h.version === normalizedVersion);

  if (targetIdx === -1) {
    return {
      version: normalizedVersion,
      tag,
      previousTag: null,
      date: null,
      subtitle: null,
      title: tag,
      body: "",
      found: false,
    };
  }

  const current = headers[targetIdx];
  const next = headers[targetIdx + 1];
  const previousTag = next ? `v${next.version}` : null;

  const sectionEndLine = next ? next.lineIndex : lines.length;
  const rawBodyLines = lines.slice(current.lineIndex + 1, sectionEndLine);
  const cleanBody = trimEdgeBlankAndDividerLines(rawBodyLines).join("\n");

  const cleanTitleSubtitle = current.subtitle
    ? current.subtitle.replace(/`/g, "").replace(/[\r\n]+/g, " ").trim()
    : null;
  const title = cleanTitleSubtitle ? `${tag} — ${cleanTitleSubtitle}` : tag;
  const heading = current.subtitle
    ? `## Release ${tag} — ${current.subtitle}`
    : `## Release ${tag}`;

  const compareUrl = previousTag
    ? `https://github.com/${repo}/compare/${previousTag}...${tag}`
    : `https://github.com/${repo}/commits/${tag}`;

  const sections = [heading];
  if (cleanBody.length > 0) {
    sections.push(cleanBody);
  }
  sections.push(
    [
      "### Verificação & Artefatos Oficiais",
      "- **Qualidade & Governança:** Suíte unitária (`bun test`) e auditoria física de linhas (`bun run check:lines`, Lei 9 `<= 500` linhas) aprovadas em Linux (`ubuntu-24.04`) e Windows (`windows-latest`).",
      "- **Binários Oficiais:** Compilados e assinados com `SHA256SUMS.txt` via GitHub Actions (`docgov-engine-linux-x64` e `docgov-engine-win-x64.exe`).",
    ].join("\n")
  );
  sections.push(`**Full Changelog**: ${compareUrl}`);

  return {
    version: normalizedVersion,
    tag,
    previousTag,
    date: current.date,
    subtitle: current.subtitle,
    title,
    body: sections.join("\n\n"),
    found: true,
  };
}

function readArgValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  const prefix = `${flag}=`;
  const eqArg = args.find((a) => a.startsWith(prefix));
  return eqArg ? eqArg.slice(prefix.length) : undefined;
}

function runCli(args: string[]): void {
  const positionalTag = args.find((a) => !a.startsWith("-"));
  const tagArg = readArgValue(args, "--tag") ?? positionalTag ?? "";
  if (!tagArg) {
    console.error("Uso: bun run ./scripts/extract_release_notes.ts --tag <vX.Y.Z> [--changelog CHANGELOG.md] [--out path] [--github-output path] [--json]");
    process.exit(1);
  }

  const changelogPath = resolve(readArgValue(args, "--changelog") ?? "CHANGELOG.md");
  if (!existsSync(changelogPath)) {
    console.error(`CHANGELOG não encontrado em: ${changelogPath}`);
    process.exit(1);
  }

  const changelogContent = readFileSync(changelogPath, "utf-8");
  const result = extractReleaseNotesFromChangelog(changelogContent, tagArg);

  const outPath = readArgValue(args, "--out");
  if (outPath && result.found) {
    const resolvedOut = resolve(outPath);
    mkdirSync(dirname(resolvedOut), { recursive: true });
    writeFileSync(resolvedOut, result.body + "\n", "utf-8");
  }

  const githubOutputPath = readArgValue(args, "--github-output") ?? process.env.GITHUB_OUTPUT;
  if (githubOutputPath) {
    const safeTitle = result.title.replace(/[\r\n]+/g, " ").trim();
    appendFileSync(githubOutputPath, `found=${result.found}\ntitle=${safeTitle}\n`, "utf-8");
  }

  if (args.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!outPath && result.found) {
    console.log(result.body);
  } else if (!result.found) {
    console.warn(`Aviso: seção para ${result.tag} não encontrada em ${changelogPath}.`);
  }
}

if (import.meta.main || process.argv[1]?.endsWith("extract_release_notes.ts")) {
  runCli(process.argv.slice(2));
}
