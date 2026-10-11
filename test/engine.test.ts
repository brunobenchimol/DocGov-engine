import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { writeFileSync, existsSync, unlinkSync, mkdirSync, rmdirSync } from "node:fs";
import { resolve } from "node:path";
import { processDocument } from "../src/index.ts";

// Base64 de um .docx OpenXML válido contendo as tags {{processo_id}} e {{objeto.descricao}}
const MINIMAL_DOCX_BASE64 =
  "UEsDBBQAAAAIADGvSl15bjPX6AAAAK0BAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbH1QyU7DMBD9" +
  "FWuuKHHggBCK0wPLETiUDxjZk8SqN3nc0v49Tlt6QIXjzFv1+tXeO7GjzDYGBbdtB4KCjsaGScHn" +
  "+rV5AMEFg0EXAyk4EMNq6NeHRCyqNrCCuZT0KCXrmTxyGxOFiowxeyz1zJNMqDc4kbzrunupYygU" +
  "SlMWDxj6Zxpx64p42df3qUcmxyCeTsQlSwGm5KzGUnG5C+ZXSnNOaKvyyOHZJr6pBJBXExbk74Cz" +
  "7r0Ok60h8YG5vKGvLPkVs5Em6q2vyvZ/mys94zhaTRf94pZy1MRcF/euvSAebfjpL49zD99QSwME" +
  "FAAAAAgAMa9KXZv9N+qtAAAAKQEAAAsAAABfcmVscy8ucmVsc43POw7CMAwG4KtE3mlaBoRQ0y4I" +
  "qSsqB7ASN61oHkrCo7cnAwNFDIy2f3+W6/ZpZnanECdnBVRFCYysdGqyWsClP232wGJCq3B2lgQs" +
  "FKFt6jPNmPJKHCcfWTZsFDCm5A+cRzmSwVg4TzZPBhcMplwGzT3KK2ri27Lc8fBpwNpknRIQOlUB" +
  "6xdP/9huGCZJRydvhmz6ceIrkWUMmpKAhwuKq3e7yCzwpuarF5sXUEsDBBQAAAAIADGvSl3nkdAq" +
  "rwAAAO8AAAARAAAAd29yZC9kb2N1bWVudC54bWxFjsEKwjAMhl+l9O46PYiMbd58Aj1LbeOsrElp" +
  "qlPG3t11Cl6+n5D8H6n3L9+LJ0R2hI1cF6UUgIasw66Rp+NhtZOCk0are0Jo5BtY7tt6qCyZhwdM" +
  "YhYgV0MjbymFSik2N/CaCwqA8+5K0es0j7FTA0UbIhlgnv2+V5uy3CqvHcqsvJB95wwZMSO14/gr" +
  "0NnZaRIrMY50uUOiwgKb6IymaapVvs2MC8PCr0/9f20/UEsBAhQAFAAAAAgAMa9KXXluM9foAAAA" +
  "rQEAABMAAAAAAAAAAAAAAAAAAAAAAFtDb250ZW50X1R5cGVzXS54bWxQSwECFAAUAAAACAAxr0pd" +
  "m/036q0AAAApAQAACwAAAAAAAAAAAAAAAAAZAQAAX3JlbHMvLnJlbHNQSwECFAAUAAAACAAxr0pd" +
  "55HQKq8AAADvAAAAEQAAAAAAAAAAAAAAAADvAQAAd29yZC9kb2N1bWVudC54bWxQSwUGAAAAAAMA" +
  "AwC5AAAAzQIAAAAA";

describe("DocGov Docx Engine", () => {
  const tempDir = resolve("./temp_test_run");
  const templatePath = resolve(tempDir, "template_input.docx");
  const statePath = resolve(tempDir, "state_input.json");
  const outputPath = resolve(tempDir, "resultado_final.docx");

  beforeAll(() => {
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }
    // Cria o template .docx válido a partir do base64
    writeFileSync(templatePath, Buffer.from(MINIMAL_DOCX_BASE64, "base64"));

    // Cria o mock de dados do estado_caso.json
    const mockState = {
      processo_id: "POC-2026-PA-001",
      objeto: {
        descricao: "Contratação de plataforma em nuvem para o Órgão Y"
      }
    };
    writeFileSync(statePath, JSON.stringify(mockState, null, 2), "utf-8");
  });

  afterAll(() => {
    // Limpeza
    if (existsSync(templatePath)) unlinkSync(templatePath);
    if (existsSync(statePath)) unlinkSync(statePath);
    if (existsSync(outputPath)) unlinkSync(outputPath);
    if (existsSync(tempDir)) rmdirSync(tempDir);
  });

  test("deve processar o template e injetar variáveis sem erros", async () => {
    const result = await processDocument(templatePath, statePath, outputPath);

    expect(result.success).toBe(true);
    expect(existsSync(outputPath)).toBe(true);
  });

  test("deve lançar erro se o template não existir", async () => {
    expect(
      processDocument("caminho_inexistente.docx", statePath, outputPath)
    ).rejects.toThrow("Template não encontrado");
  });
});

