# Playbook Operacional: Trilha Contínua de Conectores de Jurisprudência (On-Demand Connector Track)

Este playbook estabelece o protocolo autônomo canônico para implementar novos conectores de tribunais de contas estaduais e municipais (`TCE-RJ`, `TCE-RS`, `TCM-PA`, etc.) no `docgov-engine`.

---

## 1. Princípios e Regras de Versionamento
- **Modelo Sob Demanda**: Novos conectores são implementados pontualmente sob demanda via comando do usuário (*"Vamos implementar o conector <CORTE>"*), sem reter marcos funcionais maiores (`v1.5.0`, `v1.6.0`, etc.).
- **Incremento Patch (`vX.Y.Z` -> `vX.Y.Z+1`)**: Cada novo conector corresponde a 1 Patch Release em estrito lockstep com a suíte de testes e mocks do `DocGov`.
- **Conformidade Inviolável**: Respeito integral às 9 Leis do `AGENTS.md`, especialmente Lei 2 (payload MCP < 900 bytes), Lei 5 (neutralidade institucional `ORGAO_CONTRATANTE`), Lei 8 (micro-commits semânticos) e Lei 9 (teto físico de 500 linhas por arquivo).

---

## 2. Fase 1: Planejamento, Sondagem e Anti-Vampiro (`/plan`)
> [!IMPORTANT]
> **Proibição Estrita de Edição**: Nenhuma linha de código deve ser criada ou modificada durante a Fase 1. Apenas leituras seletivas e sondagens no terminal são permitidas.

### 2.1. Leitura Seletiva Obrigatória (Target-Lines Only)
Para economizar tokens e evitar contexto degradado:
1. `src/tools/juris/providers/tce_pr_provider.ts` e `tce_pr_catalog.ts` (arquitetura canônica *Live Primary + Curated Fallback* homologada na `v1.4.6`);
2. `src/tools/juris/provider_registry.ts` e `src/tools/juris/types.ts` (contratos e registro plug-and-play);
3. `test/juris/state_courts.test.ts` (verificar contagem de linhas; se ultrapassar 450 linhas, planejar `test/juris/state_courts_wave2.test.ts` para cumprir a Lei 9);
4. Linhas de versão em `package.json`, `src/constants/index.ts` e `src/mcp/spec.ts`.

### 2.2. Sondagem Real no Terminal (Obrigatória antes de Codificar)
Inspecione via terminal (`curl -i -s -L --max-time 10 ...` ou fetch one-liner Bun) a superfície pública do tribunal:
- Mapeie o portal de jurisprudência (ex.: ViaJuris, TCJuris, Sispush, Elasticsearch público ou ASP.NET/MVC);
- Identifique o método (GET ou POST), Content-Type (`application/json` ou `text/html`), parâmetros de busca, paginação e links de acórdãos íntegros (HTML ou PDF);
- Verifique se há bloqueios por WAF, Captcha ou SSL. Se a busca pública for viável sem autenticação restritiva, configure o **Live Primary**; caso contrário, documente o uso do **Curated Fallback** com indicação clara.

### 2.3. Especificação do Plano Técnico
Apresente no `/plan`:
1. **Contrato de Mock e Override**: `process.env.DOCGOV_JURIS_<CORTE>_URL` (com aliases canônicos) e suporte ao `JurisMockServer`;
2. **Normalização Bidirecional de IDs**: Reconhecimento uniforme de `<CORTE>-PREJULGADO-<N>`, `<CORTE>-SUMULA-<N>`, `<CORTE>-ACORDAO-<N>-<ANO>`, etc., em `search_juris` e `fetch_juris`;
3. **Higiene Estrita de `autoTriggerKeywords`**: Termos exclusivos do tribunal e de sua legislação (`tce-<uf>`, `tce<uf>`, `tribunal de contas do estado de ...`, decretos/leis estaduais). **PROIBIDO** usar nome do estado ou cidade isolado (ex.: "Paraná", "São Paulo") para prevenir falsos-positivos entre UFs ou entre TCE e TCM;
4. **Catálogo Curado (8 a 9 Precedentes)**: Prejulgados vinculantes, Súmulas e Consultas normativas sobre a Lei nº 14.133/2021 e Lei nº 13.303/2016, incluindo obrigatoriamente o precedente exigido no Sub-Assert `.NET` e sua calibração em `stance_alignment`.

---

## 3. Fase 2: Execução em 4 Micro-Commits Atômicos

Após aprovação do plano, execute a sequência atômica de commits:

### Micro-Commit 1 (MC-1) — Catálogo Curado
- Crie `src/tools/juris/providers/<corte>_catalog.ts` ($\le 500$ linhas) com os 8-9 precedentes, `normalize<Corte>Id`, `get<Corte>CatalogItemById` e `search<Corte>Catalog`.
- Commit: `feat(juris): implement <corte> curated normative catalog`

### Micro-Commit 2 (MC-2) — Provider e Registro Plug-and-Play
- Crie `src/tools/juris/providers/<corte>_provider.ts` ($\le 500$ linhas) implementando `JurisdictionProvider` com:
  - Live Primary (timeout 3000ms, zero retries, headers sanitizados);
  - Curated Fallback acionado quando offline, erro HTTP ou busca local;
  - Resolução no modo Mock (`DOCGOV_JURIS_<CORTE>_URL`);
  - Trava anti-alucinação imediata (`[ANTI_HALLUCINATION_BLOCK]`) para IDs inexistentes (ex.: `<CORTE>-999999`);
  - Fatiamento anatômico nas 6 Macro-Partes / 10 Sub-Camadas com neutralidade institucional (`ORGAO_CONTRATANTE`).
- Registre o provedor em `src/tools/juris/provider_registry.ts` ($\le 500$ linhas).
- Commit: `feat(juris): implement <corte> provider with live search and mock support`

### Micro-Commit 3 (MC-3) — Testes Modulares e Verificação de Linhas
- Adicione o bloco de testes em `test/juris/state_courts.test.ts` (ou crie `test/juris/state_courts_wave2.test.ts` caso o primeiro se aproxime de 500 linhas):
  - Roteamento por `uf` e `courts`;
  - Higiene de auto-trigger (rejeição de termos de outras UFs);
  - Normalização bidirecional de IDs;
  - Busca no catálogo e cálculo de `relevance_score` / `stance_alignment`;
  - Trava `[ANTI_HALLUCINATION_BLOCK]`;
  - Fatiamento anatômico em 10 sub-camadas;
  - Teto de payload sintético MCP (< 900 bytes).
- Execute:
  - `bun test test/juris/state_courts.test.ts` (ou arquivo de teste afetado);
  - `bun run ./scripts/check_lines.ts all` ($\le 500$ linhas em 100% dos arquivos auditados).
- Commit: `test(juris): add <corte> state court test coverage and anti-hallucination verification`

### Micro-Commit 4 (MC-4) — Release, Self-Discovery e Fechamento
- Atualize para a versão patch incremental `vX.Y.Z+1`:
  - `package.json` (`version`);
  - `src/constants/index.ts` (`DOCGOV_ENGINE_VERSION`);
  - `src/mcp/spec.ts` (`ENGINE_VERSION`);
  - `CHANGELOG.md` (novo bloco de versão no padrão Keep a Changelog);
  - `ROADMAP.md` (registro da corte implementada na trilha sob demanda);
  - `README.md` (seção de cortes suportadas).
- Execute:
  - `bun run dump:spec` (atualiza `docs/especificacao_motor.md`);
  - `bun run ./scripts/run_live_tests.ts --suite=juris --court=<ID>` (validação online 2/2);
  - `bun test` (bateria completa verde);
  - `bun run ./scripts/check_lines.ts all`.
- Commit: `docs(release): bump vX.Y.Z+1, update roadmap and sync self-discovery specifications`
- Crie a tag anotada: `git tag -a vX.Y.Z+1 -m "Release vX.Y.Z+1: conector estadual <CORTE> com Resiliência Dupla"`
- Envie: `git push origin <branch> ; git push origin vX.Y.Z+1`
- Monitore a esteira automatizada no GitHub Actions (`gh run watch`) sem realizar uploads manuais locais (Lei 7).
