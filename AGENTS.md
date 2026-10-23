# Estatuto de Governança do Motor MCP docgov-engine

Este documento estabelece as 8 Leis Invioláveis de Engenharia do motor standalone `docgov-engine`. Qualquer agente de IA ou desenvolvedor deve segui-las estritamente em todas as sessões e contribuições.

---

## Lei 1: Runtime e Testes Padronizados via Bun
- O runtime padrão do motor é o Bun (`bun test`, `bun run build:linux`, `bun run build:windows`).
- Nenhum arquivo ou teste do repositório deve conter caminhos absolutos hardcoded de máquinas locais.
- Na interação com o desenvolvedor, adapte a execução dos comandos com flexibilidade ao ambiente informado no diálogo (ex.: WSL, terminal nativo ou container).

## Lei 2: Teto Estrito de Payload MCP (< 1024 bytes)
- Todo retorno sintético de ferramentas via stdio MCP DEVE ter menos de 1024 bytes (UTF-8, margem segura recomendada < 920 bytes) para evitar truncamento em `output.txt` pelas IDEs consumidoras.
- Documentos grandes, mapas estruturais completos (`toc_map`), dossiês de hotspots (`dossie_hotspots_*.md`) e espelhos de leitura linear (`visao_auditoria_*.md`) são persistidos em disco (`state/estrutura_*.json`, `state/visao_auditoria_*.md`) e apenas referenciados por caminho no JSON sintético.

## Lei 3: Padrão Exact Copy-Paste Error (Zero Silent No-Op e Fail-Fast Estrito)
- É estritamente proibido retornar `status: "success"` se `applied_slots_count === 0`.
- É proibido criar auto-conversões mágicas de chaves inválidas que mascarem violações de contrato do agente consumidor.
- Ao detectar erro de validação em `slots_manifest.json` ou `relatorio_auditoria.json`, o motor deve interromper a execução com a mensagem imperativa:
  `"NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:"`
  acompanhada do snippet JSON canônico pronto para copiar e colar.

## Lei 4: Sincronia Obrigatória de Self-Discovery (Fonte Única da Verdade)
- Qualquer alteração em parâmetro, ferramenta ou comportamento deve atualizar no mesmo commit:
  1. A saída da flag `--dump-spec` (`generateEngineSpecMarkdown`);
  2. As constantes `DOCX_ENGINE_INSTRUCTIONS` e `DOCX_WORKFLOW_GUIDE_TEXT`;
  3. As descrições em `getMcpToolsDefinition()`;
  4. Os textos de orientação `next_step_hint`.

## Lei 5: Neutralidade Institucional Absoluta
- É expressamente proibido usar nomes de órgãos, entidades, estados ou localidades específicos em código, testes, fixtures ou documentação.
- Use exclusivamente identificadores genéricos ou siglas federais universais: `ORGAO_CONTRATANTE`, `MUNICIPIO_GENERICO`, `ORGAO_A`, `ORGAO_B`, `AGU`, `MGI`, `TCU`.

## Lei 6: Resiliência de Caminhos e Cache Global (`core/registry/templates/`)
- A resolução de caminhos deve ser resiliente e independente do diretório de trabalho atual (`process.cwd()`), priorizando a variável de ambiente `DOCGOV_REGISTRY_DIR` e busca ascendente a partir de `caseDir` ou `docxPath`.
- Ao carregar templates do cache global, deve-se aplicar sanity check descartando entradas corrompidas com 0 regras válidas.

## Lei 7: Ritual de Qualidade e Release
- Toda evolução exige:
  1. Atualização do número de versão SemVer em `package.json` e `src/index.ts`;
  2. Aprovação de 100% dos testes via `bun test`;
  3. Git commit convencional, criação de tag `vX.Y.Z` anotada e push para origin.

## Lei 8: Disciplina Autônoma de Micro-Commits Atômicos, Reversibilidade e Memória Evolutiva (`CHANGELOG.md` & `ROADMAP.md`)
- É terminantemente proibido realizar commits monolíticos ("Big Bang") que misturem múltiplas features, refatorações ou correções em um único disparo.
- Todo plano (`/plan`) e toda execução no repositório `docgov-engine` DEVE ser estruturada nativamente em **Micro-Commits Atômicos e Semânticos** (`feat(...)`, `fix(...)`, `test(...)`, `docs(...)`, `chore(...)`), onde cada micro-commit representa uma unidade lógica isolada e passa em 100% dos testes (`bun test`).
- Ao finalizar qualquer feature, patch ou marco, o agente DEVE obrigatoriamente e por iniciativa própria atualizar o `CHANGELOG.md` e o `ROADMAP.md`.

---

## Protocolo Operacional de Micro-Commits e Rastreabilidade Contínua

### 1. Estrutura Obrigatória de Micro-Commits em Todo `/plan`
Todo plano técnico elaborado pelo agente deve incluir explicitamente uma seção de **Fatiamento em Micro-Commits Sequenciais**, demonstrando como o trabalho será particionado antes mesmo do início das edições de código. Exemplo canônico:
- **Micro-Commit 1 (Core / Parser):** Lógica interna isolada + teste unitário do módulo (`feat(...)` / `test(...)`);
- **Micro-Commit 2 (Exposição MCP / CLI):** Interface pública, flags e schemas + teste de integração (`feat(...)` / `test(...)`);
- **Micro-Commit 3 (Self-Discovery & Governança):** Sincronização de `--dump-spec`, `DOCX_ENGINE_INSTRUCTIONS`, `CHANGELOG.md` e atualização do `ROADMAP.md` (`docs(...)`).

### 2. Garantia de Reversibilidade e Passagem de Testes por Commit
- Cada micro-commit deve deixar o repositório em estado **100% verde**, funcional e compilável (`git bisect` e `git revert` seguros).
- É proibido realizar commits intermediários com código quebrado ou testes falhando.
- Caso uma alteração introduza regressão, o commit isolado correspondente deve ser passível de reversão cirúrgica sem afetar outras funcionalidades.

### 3. Ritual Permanente entre `CHANGELOG.md` e `ROADMAP.md`
- **`CHANGELOG.md` (Memória Histórica Canônica):**
  - Documenta exclusivamente o **passado consolidado** (da `v0.0.1` à versão atual) no padrão *Keep a Changelog* (`Added`, `Changed`, `Fixed`, `Deprecated`, `Removed`, `Security`);
  - Todo novo recurso concluído ou correção aplicada deve ser registrado no `CHANGELOG.md` pelo agente de forma autônoma.
- **`ROADMAP.md` (Planejamento Futuro Estratégico):**
  - Documenta exclusivamente o **futuro planejado** (`v1.1.0+`), mantendo ponteiro no cabeçalho para o `CHANGELOG.md`;
  - Livre de histórico morto: ao concluir uma funcionalidade, o agente marca o checkbox correspondente (`[x]`); ao fechar uma release SemVer, os itens concluídos são transpostos para o `CHANGELOG.md` e removidos do corpo do `ROADMAP.md`.

### 4. Definition of Done (DoD) Global do Motor
Nenhuma tarefa ou issue é considerada concluída sem o cumprimento integral do checklist abaixo:
- [ ] **1. Testes Automatizados:** 100% de aprovação na suíte de testes (`bun test`);
- [ ] **2. Teto MCP (Lei 2):** Resposta sintética de ferramentas MCP abaixo de 1024 bytes (folga preventiva garantida `< 900 bytes`);
- [ ] **3. Self-Discovery (Lei 4):** `--dump-spec`, `DOCX_ENGINE_INSTRUCTIONS`, prompts MCP e help da CLI sincronizados;
- [ ] **4. Neutralidade Institucional (Lei 5):** Ausência de nomes específicos de órgãos/localidades;
- [ ] **5. Micro-Commits Semânticos (Lei 8):** Fatiamento atômico registrado no Git;
- [ ] **6. Memória Evolutiva (Lei 8):** `CHANGELOG.md` e `ROADMAP.md` atualizados e consistentes;
- [ ] **7. Árvore de Trabalho Limpa:** `git status` limpo sem arquivos residuais ou modificações não rastreadas.
