import { writeFileSync, mkdirSync } from "node:fs";
import { createSampleRawDocx } from "../test/helpers/fixtures.ts";

mkdirSync("smoke_test", { recursive: true });
await createSampleRawDocx("smoke_test/tpl.docx");
writeFileSync(
  "smoke_test/st.json",
  JSON.stringify({ processo_id: "CI-TEST", objeto: { descricao: "Teste CI" } })
);
writeFileSync(
  "smoke_test/audit.json",
  JSON.stringify({
    processo_id: "CI-TEST",
    artefato_auditado: "ETP",
    status_global: "CONFORME",
    contagem: { bloqueantes: 0, alertas: 0, conformes: 5 },
    resumo_executivo: "Tudo conforme.",
    apontamentos: [],
  })
);
console.log("Smoke test fixtures generated successfully.");
