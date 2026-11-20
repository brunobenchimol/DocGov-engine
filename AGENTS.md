# Estatuto de Governança do Motor MCP docgov-engine

Este documento estabelece as 9 Leis Invioláveis de Engenharia do motor standalone `docgov-engine`. Qualquer agente de IA ou desenvolvedor deve segui-las estritamente em todas as sessões e contribuições.

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
- Qualquer alteração em parâmetro, ferramenta, versão ou comportamento deve atualizar em estrito lockstep no mesmo ciclo/release:
  1. A saída da flag `--dump-spec` (`generateEngineSpecMarkdown` e `docs/especificacao_motor.md`);
  2. As constantes `DOCX_ENGINE_INSTRUCTIONS` e `DOCX_WORKFLOW_GUIDE_TEXT`;
  3. As descrições e schemas em `getMcpToolsDefinition()`;
  4. Os textos de orientação `next_step_hint`;
  5. A documentação pública, o mapa arquitetural e a memória evolutiva (`README.md`, `ROADMAP.md`, `CHANGELOG.md`, `docs/ARCHITECTURE_AND_MODULES.md` e `docs/CAPABILITIES_EVOLUTION_HISTORY.md`).

## Lei 5: Neutralidade Institucional Absoluta
- É expressamente proibido usar nomes de órgãos, entidades, estados ou localidades específicos em código, testes, fixtures ou documentação.
- Use exclusivamente identificadores genéricos ou siglas federais universais: `ORGAO_CONTRATANTE`, `MUNICIPIO_GENERICO`, `ORGAO_A`, `ORGAO_B`, `AGU`, `MGI`, `TCU`.

## Lei 6: Resiliência de Caminhos e Cache Global (`core/registry/templates/`)
- A resolução de caminhos deve ser resiliente e independente do diretório de trabalho atual (`process.cwd()`), priorizando a variável de ambiente `DOCGOV_REGISTRY_DIR` e busca ascendente a partir de `caseDir` ou `docxPath`.
- Ao carregar templates do cache global, deve-se aplicar sanity check descartando entradas corrompidas com 0 regras válidas.

## Lei 7: Ritual de Qualidade e Release Automatizada via Pipeline Externo
- Toda evolução exige:
  1. Atualização do número de versão SemVer em `package.json`, `src/constants/index.ts`, `src/mcp/spec.ts` e testes correspondentes (`test/version.test.ts`);
  2. Aprovação de 100% dos testes automatizados no ambiente local (`bun test`, incluindo a trava de lockstep documental em `test/version.test.ts`);
  3. Sincronização de especificações e documentação pública (`--dump-spec` -> `docs/especificacao_motor.md`, `docs/ARCHITECTURE_AND_MODULES.md`, `README.md`, `CHANGELOG.md` e `ROADMAP.md`);
  4. Git commit convencional, criação de tag anotada `vX.Y.Z` e envio (`git push origin <branch>` e `git push origin vX.Y.Z`).
- **Autodescoberta de Pipeline Externo e Proibição de Upload Manual (Zero Local Release):**
  - O agente DEVE inspecionar se o repositório possui esteira automatizada externa de CI/CD (ex.: `.github/workflows/`, `.gitlab-ci.yml` ou equivalente).
  - **Existindo pipeline externo configurado para tags, o push da tag Git é o gatilho canônico exclusivo de release.**
  - É **TERMINANTEMENTE PROIBIDO** tentar subir arquivos de release na mão, criar releases por comandos locais (`gh release create`) ou fazer upload manual de binários compilados na máquina de desenvolvimento. Toda compilação oficial, cálculo de checksums e publicação de assets cabem estritamente à esteira automatizada em seus runners remotos.
  - **Protocolo Observador & Dupla Defesa de Release Notes (Obrigatório):**
    1. **1ª Defesa (Automática na CI):** A seção `## [X.Y.Z] - YYYY-MM-DD — <Subtítulo>` do `CHANGELOG.md` é a fonte canônica extraída automaticamente por `scripts/extract_release_notes.ts` no `.github/workflows/release.yml` para gerar o título (`vX.Y.Z — <Subtítulo>`) e o corpo formatado da GitHub Release.
    2. **2ª Defesa (Conferência Obrigatória do Agente):** Após o push da tag, o agente deve monitorar a conclusão do pipeline externo (`gh run list` / `gh run watch`) e **obrigatoriamente** auditar a release publicada via `gh release view vX.Y.Z` (conferindo título, corpo das Release Notes no padrão editorial do projeto e os 3 assets oficiais). Se as notas geradas automaticamente estiverem incompletas, fora do padrão editorial ou demandarem enriquecimento (ex.: tabela comparativa ou métricas finais), o agente **DEVE** ajustá-las imediatamente usando exclusivamente comandos declarativos de edição de metadados (`gh release edit vX.Y.Z --title "..." --notes-file ...`), **sem nunca reinjetar ou sobrescrever os binários oficiais gerados pela esteira**.

## Lei 8: Disciplina Autônoma de Micro-Commits Atômicos, Reversibilidade e Memória Evolutiva (`CHANGELOG.md`, `ROADMAP.md` & `docs/CAPABILITIES_EVOLUTION_HISTORY.md`)
- É terminantemente proibido realizar commits monolíticos ("Big Bang") que misturem múltiplas features, refatorações ou correções em um único disparo.
- Todo plano (`/plan`) e toda execução no repositório `docgov-engine` DEVE ser estruturada nativamente em **Micro-Commits Atômicos e Semânticos** (`feat(...)`, `fix(...)`, `test(...)`, `docs(...)`, `chore(...)`), onde cada micro-commit representa uma unidade lógica isolada e passa em 100% dos testes (`bun test`).
- Ao finalizar qualquer feature, patch ou marco, o agente DEVE obrigatoriamente e por iniciativa própria atualizar o `CHANGELOG.md` e o `ROADMAP.md`, realizando também o append resumido (10 a 15 linhas) em `docs/CAPABILITIES_EVOLUTION_HISTORY.md` ao concluir cada geração ou marco evolutivo significativo.

## Lei 9: Modularidade Estrita, Teto de 500 Linhas e Economia de Tokens
- **Teto Físico de Arquivo ($\le 500$ linhas):** Nenhum arquivo `.ts` em `src/tools/juris/`, `test/`, `tests_live/` e `scripts/` (e novos módulos em `src/`) pode ultrapassar 500 linhas de código. Novas capacidades (como o motor de jurisprudência da `v1.4.x`) DEVEM nascer em subdiretórios próprios de domínio (ex.: `src/tools/juris/search_juris.ts`, `src/tools/juris/fetch_juris.ts`, `src/tools/juris/statutory_bridge.ts`, `src/tools/juris/anatomical_slicer.ts`), jamais sendo empilhadas dentro de arquivos existentes;
- **Governança Modular de Testes ($\le 500$ linhas):** É terminantemente proibido manter ou criar monólitos de teste em `test/`. A homologação de novas cortes, UFs ou funcionalidades deve ser alocada cirurgicamente no subdiretório modular de seu domínio (ex.: novos conectores de tribunais estaduais/municipais em `test/juris/state_courts.test.ts` ou sub-arquivos dedicados por corte/tier), garantindo que cada arquivo permaneça $\le 500$ linhas e seja executável de forma pontual (`bun test test/juris/state_courts.test.ts -t "TCE-SP"`);
- **Leitura Fatiada (*Target-Lines Only*):** Durante manutenções e inspeções, o agente DEVE inspecionar apenas o submódulo específico ou intervalo estrito de linhas alvo, evitando leituras integrais de arquivos grandes para prevenir sobrecarga de contexto e economia de tokens;
- **Execução Cirúrgica de Testes durante Micro-Commits:** Durante o ciclo de micro-commits intermediários (`MC-1` a `MC-3`), o agente DEVE executar apenas o arquivo de teste unitário afetado (`bun run test test/<alvo>.test.ts`), reservando a bateria completa `bun run test` (modo compacto padrão via `scripts/run_tests.ts`, ~15 linhas com heartbeat e Top 3 lentos) para o micro-commit final de fechamento de release, e `bun run test:verbose` (ou `bun test <arquivo>`) para depuração detalhada de falhas.

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
- [ ] **1. Testes Automatizados:** 100% de aprovação na suíte de testes (`bun run test`, padrão compacto via `scripts/run_tests.ts`);
- [ ] **2. Teto MCP (Lei 2):** Resposta sintética de ferramentas MCP abaixo de 1024 bytes (folga preventiva garantida `< 900 bytes`);
- [ ] **3. Self-Discovery & Lockstep Documental (Lei 4 & Lei 7):** `--dump-spec` (`docs/especificacao_motor.md`), `DOCX_ENGINE_INSTRUCTIONS`, `DOCX_WORKFLOW_GUIDE_TEXT`, prompts MCP, help da CLI, `docs/ARCHITECTURE_AND_MODULES.md` e `README.md` sincronizados com `VERSION`;
- [ ] **4. Neutralidade Institucional (Lei 5):** Ausência de nomes específicos de órgãos/localidades;
- [ ] **5. Micro-Commits Semânticos (Lei 8):** Fatiamento atômico registrado no Git;
- [ ] **6. Memória Evolutiva (Lei 8):** `CHANGELOG.md` e `ROADMAP.md` atualizados e consistentes;
- [ ] **7. Esteira de Release Automatizada & Release Notes:** Push da tag anotada efetuado, conclusão com status de sucesso na esteira externa de CI/CD (sem uploads manuais locais de artefatos) e conferência obrigatória das Release Notes publicadas (`gh release view vX.Y.Z`, ajustando via `gh release edit` se necessário);
- [ ] **8. Árvore de Trabalho Limpa:** `git status` limpo sem arquivos residuais ou modificações não rastreadas;
- [ ] **9. Modularidade e Teto de 500 Linhas (Lei 9):** Arquivos em `src/tools/juris/`, `src/utils/pdf/`, `src/contracts/`, `src/arp/`, `src/bidding/`, `src/direct_contracting/`, `src/demo_costs/`, `test/`, `tests_live/` e `scripts/` respeitando o limite $\le 500$ linhas verificado por `scripts/check_lines.ts`.

### 5. Trilha Contínua de Conectores Jurisdicionais (On-Demand Connector Track)
Sempre que o usuário solicitar a adição de um novo tribunal de contas estadual ou municipal (*"Vamos implementar o conector <CORTE>"*), o agente DEVE seguir estritamente o playbook documentado em `docs/JURIS_CONNECTOR_PLAYBOOK.md`:
1. **Fase 1 (Planejamento e Sondagem):** `/plan` obrigatório com leitura seletiva restrita (`tce_pr_provider.ts` e `tce_pr_catalog.ts`), sondagem real via terminal (`curl`) e elaboração do plano sem editar código;
2. **Fase 2 (Execução):** 4 Micro-Commits atômicos (MC-1 Catálogo, MC-2 Provider/Registry, MC-3 Testes/check_lines, MC-4 Release/Bump de Patch `vX.Y.Z+1`).

