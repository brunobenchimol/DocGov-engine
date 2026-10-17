import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ============================================================================
// Utilitários Resilientes de JSON (safeReadJsonFile, unflattenDotKeys)
// ============================================================================

export function sanitizeJsonString(raw: string): {
  sanitized: string;
  changed: boolean;
} {
  let text = raw;
  let changed = false;

  // 1. Remover BOM UTF-8 se presente
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
    changed = true;
  }

  // 2. Scanner de 1 passagem via state machine
  const chars: string[] = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escape) {
        chars.push(ch);
        escape = false;
      } else if (ch === "\\") {
        chars.push(ch);
        escape = true;
      } else if (ch === '"') {
        chars.push(ch);
        inString = false;
      } else if (ch === "\r") {
        // Quebra literal não escapada em string JSON
        if (i + 1 < text.length && text[i + 1] === "\n") {
          i++; // consome \n
        }
        chars.push("\\n");
        changed = true;
      } else if (ch === "\n") {
        chars.push("\\n");
        changed = true;
      } else {
        chars.push(ch);
      }
    } else {
      // Fora de string
      if (ch === '"') {
        inString = true;
        chars.push(ch);
      } else if (ch === ",") {
        // Olhar à frente para o próximo token não-espaço
        let j = i + 1;
        while (j < text.length && /\s/.test(text[j])) {
          j++;
        }
        if (j < text.length && (text[j] === "}" || text[j] === "]")) {
          // Trailing comma detectada: descarta a vírgula
          changed = true;
        } else {
          chars.push(ch);
        }
      } else {
        chars.push(ch);
      }
    }
  }

  return {
    sanitized: chars.join(""),
    changed,
  };
}

export function formatJsonErrorWithSnippet(
  filePath: string,
  raw: string,
  err: Error
): string {
  const msg = err.message || "";
  let targetLine = 1;
  let targetCol = 1;

  // Tentar encontrar "line X" e "column Y" na mensagem
  const lineMatch = msg.match(/(?:at line|line)\s*(\d+)/i);
  const colMatch = msg.match(/(?:column|col)\s*(\d+)/i);

  if (lineMatch) {
    targetLine = parseInt(lineMatch[1], 10);
    if (colMatch) {
      targetCol = parseInt(colMatch[1], 10);
    }
  } else {
    // Tentar encontrar "position X"
    const posMatch = msg.match(/(?:at position|position)\s*(\d+)/i);
    if (posMatch) {
      const pos = parseInt(posMatch[1], 10);
      const textUpToPos = raw.slice(0, Math.min(pos, raw.length));
      const lines = textUpToPos.split(/\r?\n/);
      targetLine = lines.length;
      targetCol = lines[lines.length - 1].length + 1;
    } else {
      const allLines = raw.split(/\r?\n/);
      targetLine = allLines.length;
      targetCol = allLines[allLines.length - 1].length;
    }
  }

  const allLines = raw.split(/\r?\n/);
  const startLine = Math.max(1, targetLine - 2);
  const endLine = Math.min(allLines.length, targetLine + 2);

  const snippetLines: string[] = [];
  for (let l = startLine; l <= endLine; l++) {
    const lineContent = allLines[l - 1] ?? "";
    if (l === targetLine) {
      snippetLines.push(`[Linha ${l}]: ${lineContent} <-- ERRO AQUI`);
    } else {
      snippetLines.push(`[Linha ${l}]: ${lineContent}`);
    }
  }

  return (
    `ERRO DE SINTAXE JSON em ${filePath} na Linha ${targetLine}, Coluna ${targetCol}. Trecho com erro:\n` +
    snippetLines.join("\n") +
    `\nCorrija diretamente esta linha usando replace_file_content.`
  );
}

export function safeReadJsonFile<T = any>(filePath: string): T {
  const resolved = resolve(filePath);
  if (!existsSync(resolved)) {
    throw new Error(`Arquivo JSON não encontrado: ${resolved}`);
  }

  const raw = readFileSync(resolved, "utf-8");

  // 1. Tentar parse padrão
  try {
    return JSON.parse(raw) as T;
  } catch (initialErr: any) {
    // 2. Tentar auto-saneamento
    const { sanitized, changed } = sanitizeJsonString(raw);
    if (changed) {
      try {
        const parsed = JSON.parse(sanitized) as T;
        // Se reparou com sucesso, regravar arquivo limpo no disco
        try {
          writeFileSync(resolved, sanitized, "utf-8");
        } catch {
          // Ignora se for read-only
        }
        return parsed;
      } catch {
        // Falha persistiu, segue para o diagnóstico cirúrgico
      }
    }

    // 3. Falha irrecuperável: emitir diagnóstico cirúrgico
    const formattedError = formatJsonErrorWithSnippet(
      resolved,
      raw,
      initialErr
    );
    throw new Error(formattedError);
  }
}

export function unflattenDotKeys(obj: any): any {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => unflattenDotKeys(item));
  }

  const result: Record<string, any> = { ...obj };

  for (const [key, value] of Object.entries(obj)) {
    const processedValue =
      typeof value === "object" && value !== null
        ? unflattenDotKeys(value)
        : value;

    if (key.includes(".")) {
      const parts = key.split(".");
      let current = result;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (
          !current[part] ||
          typeof current[part] !== "object" ||
          Array.isArray(current[part])
        ) {
          current[part] = {};
        }
        current = current[part];
      }
      const lastPart = parts[parts.length - 1];
      if (
        typeof processedValue === "object" &&
        processedValue !== null &&
        !Array.isArray(processedValue) &&
        typeof current[lastPart] === "object" &&
        current[lastPart] !== null &&
        !Array.isArray(current[lastPart])
      ) {
        current[lastPart] = { ...current[lastPart], ...processedValue };
      } else {
        current[lastPart] = processedValue;
      }
    } else {
      result[key] = processedValue;
    }
  }

  return result;
}

