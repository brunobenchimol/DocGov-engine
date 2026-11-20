// Runner compacto de testes (docgov-engine): heartbeat, Top 3 lentos e modo --verbose (Lei 9)
const rawArgs = process.argv.slice(2);
const isVerbose = rawArgs.includes("--verbose") || rawArgs.includes("-v");
const passthroughArgs = rawArgs.filter((a) => a !== "--verbose" && a !== "-v");

if (isVerbose) {
  const proc = Bun.spawn(["bun", "test", ...passthroughArgs], { stdio: ["inherit", "inherit", "inherit"] });
  process.exit(await proc.exited);
}

const ANSI_RE = /\x1B\[[0-9;]*[a-zA-Z]/g;
const FILE_HEADER_RE = /^(test[\\/][^\s:]+\.test\.ts):$/;
const PASS_LINE_RE = /^\(pass\)\s+/;
const FAIL_TRIGGER_RE =
  /^(\(fail\)|error:|Error:|SyntaxError:|TypeError:|ReferenceError:|✗|\d+\s+tests?\s+failed:|Unhandled|panic)/i;
const SUMMARY_LINE_RE =
  /^(\s*\d+\s+(?:pass|fail|skip|todo|expect\(\)\s+calls)\b|Ran\s+\d+\s+tests?\s+across\s+\d+\s+files?\.)/;
const DURATION_MS_RE = /\[(\d+(?:\.\d+)?)ms\]\s*$/;
const INIT = "inicializando...";

const stripAnsi = (s: string): string => s.replace(ANSI_RE, "");

function countExpectedFiles(args: string[]): number {
  const explicit = args.filter((a) => !a.startsWith("-") && a.endsWith(".test.ts"));
  if (explicit.length > 0) return explicit.length;
  let count = 0;
  for (const _ of new Bun.Glob("test/**/*.test.ts").scanSync({ cwd: process.cwd() })) count++;
  return count || 66;
}

const totalExpectedFiles = countExpectedFiles(passthroughArgs);
const suiteStartMs = Date.now();
let lastProgressEventMs = suiteStartMs;
let currentFile = INIT;
let currentFileStartMs = suiteStartMs;
let currentFileSumMs = 0;
let currentFileHeaderPrinted = false;
let completedFiles = 0;
let inFailureBlock = false;
let anyErrorPrinted = false;
const fileTimings = new Map<string, number>();
const summaryLines: string[] = [];
const recentStderrLines: string[] = [];

function finalizeCurrentFile(): void {
  if (currentFile === INIT) return;
  const effectiveMs = Math.max(currentFileSumMs, Date.now() - currentFileStartMs);
  fileTimings.set(currentFile, (fileTimings.get(currentFile) ?? 0) + effectiveMs);
  completedFiles++;
  lastProgressEventMs = Date.now();
  if (completedFiles % 10 === 0) {
    const elapsedSec = ((Date.now() - suiteStartMs) / 1000).toFixed(1);
    console.log(`[${completedFiles}/${totalExpectedFiles}] ${elapsedSec}s ok`);
  }
}

const proc = Bun.spawn(["bun", "test", ...passthroughArgs], {
  stdout: "pipe",
  stderr: "pipe",
  env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
});

const heartbeat = setInterval(() => {
  if (Date.now() - lastProgressEventMs >= 12_000) {
    const elapsedSec = ((Date.now() - suiteStartMs) / 1000).toFixed(1);
    console.log(`[...] executando ${currentFile} (${elapsedSec}s)`);
  }
}, 12_000);
(heartbeat as any).unref?.();

async function consumeStream(stream: ReadableStream<Uint8Array> | null, onLine: (l: string) => void) {
  if (!stream) return;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) !== -1) {
      onLine(stripAnsi(buf.slice(0, idx).replace(/\r$/, "")));
      buf = buf.slice(idx + 1);
    }
  }
  if (buf.length > 0) onLine(stripAnsi(buf.replace(/\r$/, "")));
}

function handleStderrLine(line: string): void {
  const trimmed = line.trim();
  if (!trimmed) return;
  if (!PASS_LINE_RE.test(trimmed)) {
    recentStderrLines.push(line);
    if (recentStderrLines.length > 40) recentStderrLines.shift();
  }
  const fileMatch = trimmed.match(FILE_HEADER_RE);
  if (fileMatch) {
    finalizeCurrentFile();
    currentFile = fileMatch[1].replace(/\\/g, "/");
    currentFileStartMs = Date.now();
    currentFileSumMs = 0;
    currentFileHeaderPrinted = false;
    inFailureBlock = false;
    return;
  }
  const durMatch = trimmed.match(DURATION_MS_RE);
  if (durMatch) currentFileSumMs += Number(durMatch[1]);
  if (SUMMARY_LINE_RE.test(trimmed)) {
    inFailureBlock = false;
    summaryLines.push(trimmed);
    return;
  }
  if (PASS_LINE_RE.test(trimmed)) {
    inFailureBlock = false;
    return;
  }
  if (FAIL_TRIGGER_RE.test(trimmed) || inFailureBlock) {
    inFailureBlock = true;
    anyErrorPrinted = true;
    if (currentFile !== INIT && !currentFileHeaderPrinted) {
      console.error(`\n${currentFile}:`);
      currentFileHeaderPrinted = true;
    }
    console.error(line);
  }
}

let exitCode = 1;
try {
  await Promise.all([
    consumeStream(proc.stdout, (line) => {
      if (inFailureBlock && line.trim()) console.error(line);
    }),
    consumeStream(proc.stderr, handleStderrLine),
  ]);
  exitCode = await proc.exited;
  finalizeCurrentFile();
} finally {
  clearInterval(heartbeat);
}

if (exitCode !== 0 && !anyErrorPrinted && recentStderrLines.length > 0) {
  console.error(recentStderrLines.join("\n"));
}
if (summaryLines.length > 0) console.log(summaryLines.join("\n"));
if (fileTimings.size > 0) {
  const top3 = [...fileTimings.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([f, ms], i) => `${i + 1}) ${f} (${(ms / 1000).toFixed(2)}s)`)
    .join(" | ");
  console.log(`Top 3 lentos: ${top3}`);
}
process.exit(exitCode);
