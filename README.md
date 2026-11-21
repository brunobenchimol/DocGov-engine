# docgov-engine — Motor Standalone Determinístico & Servidor MCP (v1.7.0)

[![Continuous Integration](https://github.com/brunobenchimol/DocGov-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/brunobenchimol/DocGov-engine/actions/workflows/ci.yml)
[![Live API Contract Smoke Tests](https://github.com/brunobenchimol/DocGov-engine/actions/workflows/live_api_smoke.yml/badge.svg)](https://github.com/brunobenchimol/DocGov-engine/actions/workflows/live_api_smoke.yml)

Motor unificado para o **ciclo completo de documentos Microsoft Word (`.docx`), planilhas (`.xlsx`/`.csv`), minutas e notas técnicas em Markdown/Texto (`.md`/`.txt`) e engenharia reversa/cartografia/auditoria determinística de Editais, Termos de Referência e anexos em PDF (`.pdf`)**, além de servidor **Model Context Protocol (MCP)** via `stdio`, projetado para o ecossistema **DocGov** e compatível com qualquer agente de IA (Google Antigravity, Claude Code, Claude Desktop, Cursor, VS Code Copilot e Windsurf).

Compilado em **binário standalone** (Windows `x64` e Linux `x64`) via Bun — não requer Node.js, Bun ou interpretadores externos instalados na máquina do usuário final.

---

## 1. Instalação Rápida e Auto-Atualização

### Instalação Automática em 1 Linha (Recomendado)

#### Windows (PowerShell)
Instala o binário em `$env:LOCALAPPDATA\docgov\bin\docgov-engine.exe`, valida a integridade do arquivo (> 50 MB), testa `--version` e exibe o snippet pronto para MCP:
```powershell
irm https://raw.githubusercontent.com/brunobenchimol/DocGov-engine/main/scripts/install.ps1 | iex
```

#### Linux / WSL (Bash)
Instala o binário em `~/.docgov/bin/docgov-engine`, concede permissão de execução, valida a versão e orienta sobre o PATH:
```bash
curl -fsSL https://raw.githubusercontent.com/brunobenchimol/DocGov-engine/main/scripts/install.sh | bash
```

---

### Download Manual Direto (Alternativa)

#### Windows (PowerShell)
```powershell
curl.exe -fL "https://github.com/brunobenchimol/DocGov-engine/releases/latest/download/docgov-engine-win-x64.exe" -o docgov-engine.exe
.\docgov-engine.exe -v
```

#### Linux / WSL (Bash)
```bash
curl -fL "https://github.com/brunobenchimol/DocGov-engine/releases/latest/download/docgov-engine-linux-x64" -o docgov-engine
chmod +x docgov-engine
./docgov-engine -v
```

---

### Configuração no Claude Desktop ou Antigravity MCP

Adicione ao seu arquivo de configuração MCP (`claude_desktop_config.json` ou similar):

#### Windows
```json
{
  "mcpServers": {
    "docgov-engine": {
      "command": "C:\\caminho\\para\\docgov-engine.exe",
      "args": []
    }
  }
}
```

#### Linux / WSL
```json
{
  "mcpServers": {
    "docgov-engine": {
      "command": "/caminho/para/docgov-engine",
      "args": []
    }
  }
}
```

### Auto-Atualização do Binário (`Self-Update`)
Depois de baixado pela primeira vez, o próprio binário consegue verificar novas releases no GitHub e atualizar a si mesmo:
```powershell
# Verificar se há uma nova versão disponível
./docgov-engine --check-update

# Atualizar automaticamente para a versão mais recente (se houver)
./docgov-engine --update

# Forçar download e reinstalação da última release
./docgov-engine --force-update
```

---

## 2. Destaques da Série `v1.7.x` — Versão Atual `v1.7.0` (Geração 7.0 — 2ª Perna Anti-Fraude Parte 1 + Pilares Criptográfico & Documental)

A versão **`v1.7.0`** inaugura a **Geração 7.0 (Marco 10.1)** com os **Pilares Anti-Fraude 1 e 5** 100% Pure-JS (zero dependências nativas externas), mantendo exatamente as **16 ferramentas MCP** sob o orçamento de tokens do Eixo 5 (`<= 600` caracteres por `description` e `< 900B` por retorno):
- **Perícia Criptográfica `PKCS#7/CMS/PAdES` & `/ByteRange` (`src/utils/pdf/asn1_der_parser.ts`, `pades_signature_auditor.ts`):** Parser Pure-JS `ASN.1/DER/BER`, extração ICP-Brasil `2.16.76.1.3.1`/`.3` (`CPF`/`CNPJ`), seleção do certificado folha via `SignerInfo.sid`, detecção de certificados autoassinados/não confiáveis (`[FORENSIC_UNTRUSTED_OR_SELF_SIGNED_CERT_BLOCK]`), confronto de identidade sem falso-positivo PF vs. PJ (`[FORENSIC_SIGNER_IDENTITY_MISMATCH_BLOCK]`) e auditoria de hash `/ByteRange` contra adulteração incremental pós-assinatura sem falso-positivo em co-assinaturas visuais (`/Subtype /Form`) (`[FORENSIC_PDF_INCREMENTAL_TAMPERING_AFTER_SIGNATURE_BLOCK]`).
- **Validador NF-e 44 Dígitos, Clones `w:rsid`, `.xlsx` Forense & `unknown_keys` Gen6 (`src/utils/forensics/`):** Recálculo Módulo 11 + confronto `CNPJ`/`AAMM` em diligências ACT Via B e Contratação Direta (`[FORENSIC_NFE_44_DIGIT_CHECK_DIGIT_INVALID_BLOCK]`, `[FORENSIC_NFE_KEY_CNPJ_OR_DATE_MISMATCH_BLOCK]`), clonagem OpenXML por `w:rsidRoot` / `w:rsidR` mesmo com `Author` apagado (`[FORENSIC_DOCX_RSID_CLONE_COLLUSION_BLOCK]`), `forensic_meta` em `.xlsx` (`xlsx_forensic_meta.ts`) e detector determinístico de `unknown_keys` na Gen6 (Lei 3).

### 🏗️ Principais Inovações da Geração 6.5 — Eixo 2 (`v1.6.6`):
1. **16ª Ferramenta MCP `docgov_audit_engineering_works` & CLI `audit-engineering-works` (Obras e Serviços de Engenharia):**
   - **BDI Acórdão TCU nº 2.622/2013 & Súmulas 253/254:** Validação algébrica da fórmula oficial do BDI, tabela de quartis (1ºQ, Médio, 3ºQ) por tipologia de obra, exigência de BDI Diferenciado reduzido para materiais/equipamentos relevantes (Súmula TCU nº 253), bloqueio de *bis in idem* (Administração Local, Canteiro e Mobilização dentro do BDI), vedação de IRPJ/CSLL (Súmula TCU nº 254) e trava de medição proporcional da Administração Local ao avanço físico.
   - **Curva ABC `SINAPI`/`SICRO`, CPRB Lei nº 14.973/2024, *Front-Loading* & Contratação Integrada:** Classificação ABC (Faixas A/B/C) contra medianas referenciais (Decreto nº 7.983/2013), validação da simetria tributária Com/Sem Desoneração e transição gradual da CPRB (2024–2028+), detector de *front-loading* no cronograma físico-financeiro, Matriz de Alocação de Riscos em Contratação Integrada/Semi-Integrada, integração nativa com `inexequibility_evaluator.ts` (`< 75%`, garantia adicional `< 85%`, Súmula 262 e Jogo de Planilha) e compilação de `engineering_works_audit.json`, `engineering_works_audit.md`, `laudo_pericial_obras_engenharia.docx` e `.pdf`.

### 🚀 Principais Inovações da Geração 6.5 — Eixo 1 (`v1.6.5`):
1. **15ª Ferramenta MCP `docgov_audit_demo_regime` & CLI `audit-demo-regime` (Regime DEMO & Laudo Pericial):**
   - **Planilha de Custos Módulos 1 a 6 em Centavos Inteiros (Anexo VII-D):** Validação determinística de salário-base vs. piso CCT, Súmula 448 TST e LTCAT (Módulo 1), 13º/Férias + CPP 20%/FGTS 8%, SAT/RAT × FAP e VT 6%/VA (Módulo 2), APT `<= 1,94%` no 1º ano e multa FGTS (Módulo 3), reposição de ausentes (Módulo 4), insumos/EPIs/depreciação (Módulo 5) e Gross-Up "por dentro" com alíquota efetiva EFD no Lucro Real (Acórdão TCU 1.214/2013) e vedação ao Simples Nacional salvo Anexo IV em limpeza/vigilância (Módulo 6).
   - **Produtividade Anexo VI-B & Decreto Federal nº 12.174/2024:** Auditoria de faixas de produtividade em $m^2$, vedação de redução salarial na transição `44h -> 40h` e verificação de reserva de vagas para mulheres vítimas de violência doméstica.
   - **Governança de Execução & Laudo Pericial DOCX/PDF:** Expurgo de 90% do APT na 1ª prorrogação (`1,94% -> 0,194%` — Acórdão TCU 1.586/2018), Conta-Depósito Vinculada (Anexo XII: `29,50%..31,33%`) vs. Pagamento pelo Fato Gerador, memória de Repactuação Anual por CCT (Art. 135) e compilação de `demo_regime_audit.json`, `demo_regime_audit.md`, `laudo_pericial_planilha_demo.docx` e `.pdf`.

### 🚀 Principais Inovações da Geração 6 (`v1.6.0` / `v1.6.1` / `v1.6.2`):
1. **13ª Ferramenta MCP `docgov_evaluate_bidding_proposals` & CLI `evaluate-proposals` (Fase Externa, TIC, Inexequibilidade, Conluio e Fase Recursal):**
   - **Modelos de TIC sem DEMO & Conversibilidade de ACT:** Suporte determinístico a UST, HST, Hora-Técnica, Pontos de Função (PF) e SQUADs, além de análise de conversibilidade de Atestados de Capacidade Técnica (Súmula TCU 263) e qualificação econômico-financeira (`ILG`, `ILC`, `ISG`, `EG`).
   - **Inexequibilidade `< 75%` / Garantia Adicional `75%..85%` & Jogo de Planilha:** Aplicação matemática do Art. 59, §§ 4º e 5º da Lei nº 14.133/2021 e Súmula TCU 262 (presunção relativa de inexequibilidade abaixo de 75%, garantia adicional entre 75% e 85%) e detecção de sobrepreço por jogo de planilha entre itens unitários.
   - **Perícia Forense de ACT em 7 Vetores & Anti-Conluio em Lote:** Verificação de janela temporal (`> 180` dias), colisão de metadados `Author` com licitante, rastros de softwares editores (`[ACT_PDF_EDITING_SOFTWARE_TRACE_SUSPICION]`) e auditoria cruzada de conluio entre propostas concorrentes.
   - **Fase Recursal Administrativa (Art. 165 e Art. 168):** Avaliação e compilação OpenXML/PDF de Razões Recursais, Contrarrazões e Decisão fundamentada do Pregoeiro com encaminhamento à Autoridade Superior.
2. **14ª Ferramenta MCP `docgov_audit_direct_contracting` & CLI `audit-direct-contracting` (Dispensa, Inexigibilidade e Parcerias Estatais):**
   - **Inexigibilidade (Art. 74 / Súmula TCU 255) & Justificativa de Preço:** Verificação de exclusividade/notória especialização e exigência de no mínimo 3 notas fiscais ou contratos anteriores do próprio fornecedor, detectando sobrepreço (`[INEXIGIBILITY_OVERPRICING_ABOVE_SUPPLIER_MARKET_PROOF_BLOCK]`) e cotações simuladas por metadados compartilhados (`[PRICE_QUOTATION_SHARED_METADATA_SIMULATION_BLOCK]`).
   - **Dispensa por Valor & Controle Anti-Fracionamento:** Somatório determinístico anual por Unidade Gestora (UG) e ramo do objeto (PDM/CATMAT/CATSER).
   - **Oportunidade de Negócio / Parceria Estratégica em Estatais:** Validação de requisitos do Art. 28, § 3º, II da Lei nº 13.303/2016 e compilação do Parecer de Instrução Processual em `.docx`/`.pdf`.
3. **Pipeline PDF `unpdf@2.1+`, Ponte Multimodal `assets/` & Perícia Forense Dual `PDF/DOCX` (`v1.6.2`):**
   - **Classificação Multimodal em 5 Classes (`inspectPages`):** Classifica cada página em `BORN_DIGITAL`, `FULL_PAGE_SCAN`, `HYBRID_HEADER_SCAN_TRAP`, `EMBEDDED_VISUAL_ASSET` ou `OCR_LAYER_EMBEDDED`, preservando 100% da compilação standalone sem dependências nativas (`@napi-rs/canvas`).
   - **Ponte Multimodal `assets/` com Filtro Anti-Brasão SHA-256:** Extrai imagens relevantes em pure-JS, descarta logotipos/brasões decorativos (dimensão mínima e SHA-256 repetido em `>= 3` páginas), materializa até `20` PNGs em `assets/<stem>/pag_XXX_img_YY.png` e injeta âncoras `[PAG_XXX | ASSET_IMG_YY | ...]` em `visao_auditoria_*.md` e `dossie_hotspots_*.md`.
   - **Perícia Forense Dual `PDF/DOCX` (`getMeta` + `docProps`):** Extrai metadados de autoria/criação/assinatura digital em `.pdf` e `.docx` (`docProps/core.xml` + `docProps/app.xml`), detecta manipulação por editores (`Canva`, `iLovePDF`, `Sejda`, `Smallpdf`, `CorelDRAW`, `Photoshop`, etc. — `[PDF_EDITOR_MANIPULATION_TRACE]`) e sinaliza conluio cruzado (`[BID_RIGGING_SHARED_AUTHOR_METADATA_ALERT]`) no `bootstrap_case` e `indice_mestre_caso.md`.

### 🚀 Principais Inovações da Geração 5 (`v1.5.0` — `v1.5.6` — Marco 8 a Marco 8.6):
1. **11ª Ferramenta MCP `docgov_audit_contract_execution` & CLI `--audit-contract` (Fiscalização Contratual, Aditivos, Reajustes, PAS Federativo e Dosimetria):**
   - **Adequação Federativa do PAS & Dosimetria LINDB Art. 22 (Marco 8.6):** Alcance territorial estrito do impedimento (Art. 156, § 4º — `[PAS_SANCTION_TERRITORIAL_SCOPE_MISMATCH_BLOCK]`), regime estrito das Estatais `<= 24` meses sem inidoneidade (Art. 83, III Lei 13.303 — `[PAS_STATE_ENTERPRISE_SANCTION_REGIME_MISMATCH_BLOCK]`), competência exclusiva e parecer jurídico conclusivo na inidoneidade (`[PAS_INCOMPETENT_AUTHORITY_FOR_DEBARMENT_BLOCK]`), resolução de `competent_audit_court` e cadastros `CEIS`/`CNEP`/`PNCP`/`TCE-TCM` (`[PAS_EXTERNAL_CONTROL_REGISTRY_OMISSION_ALERT]`), e calibragem jurisprudencial LINDB Art. 22 com detecção de outliers (`[PAS_ARBITRARY_UNANCHORED_DOSIMETRY_ALERT]` e `[PAS_DISPROPORTIONATE_SANCTION_OUTLIER_BLOCK]`).
   - **Limites Legais de Aditamento Sem Compensação:** Cálculo isolado de acréscimos e supressões de 25% (obras, compras e serviços em geral) e 50% (reforma de edifício ou de equipamento) nos termos do Art. 125 da Lei nº 14.133/2021 e Art. 81 da Lei nº 13.303/2016. Vedação matemática absoluta de compensação entre acréscimos e supressões (`[ADDENDUM_COMPENSATION_FORBIDDEN]`).
   - **Consensualidade Obrigatória no Regime das Estatais:** Bloqueio determinístico de alterações unilaterais em empresas estatais sem comprovação de acordo bilateral (`[STATE_ENTERPRISE_UNILATERAL_ADDENDUM_BLOCK]`).
   - **Bloqueio Determinístico de Aditivo em ARP:** Bloqueio mandatório se o instrumento alvo de aditivo quantitativo for diretamente uma Ata de Registro de Preços (`[ILLEGAL_ARP_ADDENDUM_BLOCK]`).
   - **Batimento Cruzado Tripartite e Quadripartite:** Confronto integral `[TR/Edital] <-> [Proposta] <-> [ARP] <-> [Contrato / OS / Fatura]`, detectando sobrepreço unitário/global (`[TRIPARTITE_OVERPRICING_DETECTED]`), desvios de especificação e pagamentos antecipados sem garantia.
   - **Monitoramento de Reajustes e Repactuações:** Validação estrita do interregno mínimo de 12 meses (365 dias) a partir da data-base do orçamento ou da CCT (`[READJUSTMENT_INTERREGNUM_VIOLATION_12M]`).
2. **12ª Ferramenta MCP `docgov_govern_arp` & CLI `--govern-arp` (Governança Determinística de ARP e Caronas):**
   - **Travas matemáticas de carona de 50% individual e 200% global acumulada (o dobro):** Trava individual por item de 50% para órgãos não participantes (`[ARP_INDIVIDUAL_LIMIT_EXCEEDED_50PCT]`) e livro-razão de controle global bloqueando adesões acumuladas que excedam 200% (o dobro) do quantitativo registrado na Ata (`[ARP_GLOBAL_LIMIT_EXCEEDED_200PCT]`), resguardando os quantitativos do órgão gerenciador e participantes.
   - **Matriz de compatibilidade jurídica e federativa:** Verificação de simetria legal entre órgãos (`Lei 14.133` vs `Lei 13.303` — `[ARP_REGIME_ASYMMETRY_BLOCK]`), bloqueio ascendente vedado (União e Estados aderindo a ARP Municipal — Art. 86, § 3º e § 8º da Lei nº 14.133/2021 — `[ARP_FEDERATIVE_ASCENDING_BLOCK]`) e condicionantes de TIC em lote único (`[ARP_ICT_UMBRELLA_LOT_BLOCK]`).
   - **Vigência 12+12 meses e renovação de saldo:** Monitoramento da vigência da ARP (12 meses prorrogáveis por igual período), auditoria de cláusula editalícia e comprovação de vantagem econômica para renovação de saldos no 2º ano (`[ARP_RENEWAL_WITHOUT_EDITAL_CLAUSE_BLOCK]`), e rastreamento do desacoplamento da vigência autônoma de contratos derivados (de até 5 anos / 60 meses).
   - **Compilação nativa OpenXML `.docx`/`.pdf` de ARP:** Geração automatizada de `Nota_Tecnica_Anuencia_ou_Negativa_Adesao_ARP.docx/.pdf` (para o órgão gerenciador) e `Estudo_Tecnico_Vantajosidade_Adesao_ARP.docx/.pdf` (para o órgão aderente).

### 🏛️ Destaques da Geração 4 & Trilha Contínua (`v1.4.x` / `v1.6.8` — 12 Cortes Homologadas & Onda 3 Municipal):
1. **9ª Ferramenta MCP `search_juris` & CLI `--search-juris` (Triagem Rápida & Ranking):**
   - Busca textual sob demanda em APIs oficiais de controle externo com suporte a multi-query paralela com separador pipe `|` (`Promise.all`).
   - **Estágio 1 do Funil:** Extrai apenas a Ficha de Triagem Rápida (`Cabeçalho + Ementa + Dispositivo`) sem download antecipado de textos longos.
   - Suporte a execução dentro de casos (`state/juris_search_results.json` e `.md`) ou em modo livre isolado em pasta temporária segura (`%TEMP%/docgov_ephemeral_inspect/`).
   - Retorno sintético MCP conciso estritamente $< 900$ bytes (Lei 2).
2. **Matriz de Equivalência Normativa (`Statutory Bridge: Lei 13.303/16 + RILC <-> Lei 14.133/21`):**
   - 10 eixos normativos canônicos (`SB-01` a `SB-10`) mapeando equivalências entre a Lei das Estatais e a Lei Geral de Licitações (padronização, lote único/indivisibilidade, atestados técnicos, vigência de 5 anos, orçamento sigiloso, etc.).
   - Reconhecimento automático de empresas públicas estratégicas de TI (`Serpro`, `Dataprev`, `BB Tecnologia`, `Petrobras`, etc.) com distinguishing pró-estatais.
3. **Motor de Ranking de Relevância Determinístico (`0..100 pts`):**
   - Ordenação ponderada em 5 dimensões: aderência léxica (`0..35 pts`), alinhamento tático com postura `DEFENSE` ou `ATTACK` (`0..25 pts`), afinidade de regime legal (`0..20 pts`), peso de colegiado/quórum (`0..10 pts`) e contemporaneidade (`0..10 pts`).
4. **10ª Ferramenta MCP `fetch_juris` & CLI `--fetch-juris` (Fatiamento Anatômico e Dossiê):**
   - **Trava Anti-Alucinação Estrita:** Bloqueio mandatório de precedentes fictícios com `[ANTI_HALLUCINATION_BLOCK]`.
   - **Fatiador Anatômico Avançado (`AnatomicalSlicer`):** Decomposição em 6 Macro-Partes e 10 Sub-Camadas semânticas (Cabeçalho, Ementa, Controvérsia Fática, Argumentos de Defesa, Análise da Unidade Técnica AudTI/Sefti, Ratio Decidendi, Dispositivo e Fecho com Quórum).
   - **Saída Dupla:** Dossiê Fatiado por tópico no Estágio 2 (`state/dossie_juris_<shortname>.md`) e Inteiro Teor Estruturado no Estágio 3 (`inputs/juris_<shortname>/inteiro_teor_anatomico.md`).
5. **Arquitetura 100% Plug-and-Play de Provedores (`JurisdictionProviderRegistry`):**
   - Desacoplamento integral de cortes e UFs: novos tribunais são registrados declarativamente com metadados (`tier`, `uf`, `defaultFederal`, `envOverrideKey`, `liveSmokeQuery`, `idPatterns`).
   - Política evolutiva canônica: **1 Conector / UF = 1 Patch Release**.
   - Cortes operacionais ativas: Camada Federal (**TCU**, **STJ**, **STF**, **TST**, **AGU**), Estadual/Distrital (**TCE-PA**, **TCE-CE**, **TCDF**, **TCE-SP**, **TCE-MG**, **TCE-PR**) e Municipal (**TCM-PA** — 1º conector da Onda 3 com coexistência via `sphere`).
   - **Resiliência Dupla:** Conectores com *Live Primary* (busca em APIs oficiais públicas) e *Catálogo Normativo Curado Local* (Súmulas e Consultas vinculantes determinísticas instantâneas).
   - **Graceful Fallback:** Caso solicitada UF não implementada (ex.: `RJ` ou `RS`), o motor executa automaticamente a camada federal e reporta `unimplemented_uf_requested` no payload sintético sem travar a execução.
6. **Compilador Tático OpenXML (Lockstep C# Assert 29.6):**
   - Compilação sob demanda de Nota de Contrarrazões Jurídicas (`compileDefenseCounterReasoningDocx`) e Peça de Impugnação/Representação (`compileAttackChallengeDocx`) em layout vertical A4 corporativo com zero tabelas `<w:tbl>` e cards com bordas laterais coloridas.
7. **Auto-Discovery Dinâmico e Seletor de Tribunal (`--court=<ID>`) em Live Tests:**
   - Varre dinamicamente todos os conectores registrados no `JurisdictionProviderRegistry` (`bun run test:live:juris`), executando 25 sondas (2 sondas por corte em 12 cortes + 1 de Graceful Fallback) com diagnóstico claro de origem (`[API Live Direta]`, `[Híbrido]`, `[Fallback Curado Local]`), ou permite auditoria cirúrgica de tribunais específicos (`--court=TCM-PA`, `--court=TCE-MG`, `--court=TCE-SP,TCE-MG`, `--court=ALL`).

---

### 🏛️ Pilares de Capacidades do Motor DocGov (Visão Consolidada)

1. **Governança de Casos & Ingestão Multimodal (`bootstrap_case`):**
   - Inicialização padronizada de diretórios (`inputs/`, `state/`, `templates/`, `output/`).
   - Descompactação automática de arquivos compactados (`.zip`, `.tar`, `.tar.gz`, `.tgz`) com classificação `libmagic msooxml`, proteção Anti-Zip Slip e descarte de lixo de sistema (`__MACOSX`, `.DS_Store`).
   - Auto-batismo de uploads anônimos (`media_*`) com nomes semânticos e identificação de extensões via magic bytes (`PK\x03\x04` e `%PDF`).
   - Geração do Índice Mestre do Caso (`state/indice_mestre_caso.md`).
2. **Engenharia Reversa Estrutural & Cartografia Sem IA (`inspect_doc`):**
   - Suporte nativo a `.docx`, `.pdf`, planilhas `.xlsx`/`.csv` e textos `.md`/`.txt`.
   - Cartografia em 3 camadas: `outline_headings`, `page_signals` e **Radar das 14 Zonas de Impugnação (`Z1` a `Z14`)**.
   - Agrupamento no eixo Y e reconstrução de colunas com ` | ` em PDFs, gerando coordenada de leitura `[PAG_XXX | LYYYY]`.
   - Dossiê de Hotspots (`state/dossie_hotspots_<stem>.md`) com contexto cirúrgico de $\pm 12$ linhas nas zonas críticas.
   - Matching 1-para-N contra Cache Global (`core/registry/templates/`) e auto-reancoragem de coordenadas (Auto-Offset).
3. **Auditoria Matemática Orçamentária & Diff Semântico:**
   - Auditoria aritmética em **centavos inteiros (`BigInt`)** de planilhas orçamentárias ($\text{Qtd} \times \text{Unit} = \text{Total}$, subtotais e total geral), integrando divergências às zonas `Z10`/`Z12` (`state/auditoria_orcamentaria_<stem>.json`).
   - Diff semântico granular em nível de token (algoritmo LCS com regex Unicode) entre versões de minutas e editais (`state/diff_documental_<stem>.md`).
4. **Parametrização & Injeção OpenXML de Alta Fidelidade:**
   - `build_docx_template`: criação de templates com coordenadas compactas (`T0.R1.C1`, `P3`, etc.), operador `remove_table_rows` e fail-fast com Exact Copy-Paste Error.
   - `fill_docx_template`: injeção de dados (`{{...}}`, loops, condicionais), conversão nativa de tabelas Markdown para elementos OpenXML `<w:tbl>`, herança nativa de `<w:numPr>` na árvore de numeração, reancoragem contextual de prefixos multinível e exportação híbrida para PDF (Word COM e Pure-JS).
   - `generate_audit_docx` & `generate_technical_note_docx`: relatórios executivos e notas comparativas em layout vertical corrido A4 (zero tabelas `<w:tbl>`).
5. **Conectores Externos Oficiais (PNCP & Jurisprudência):**
   - `fetch_pncp` e `search_pncp`: descoberta e download determinístico de contratações públicas de referência do Portal Nacional de Contratações Públicas (IN SEGES/ME nº 65/2021) com isolamento estrito em subpastas e resolução de redirects.
   - `search_juris` e `fetch_juris`: pesquisa e fatiamento anatômico de julgados em cortes de contas e tribunais superiores (12 cortes homologadas, incluindo `TCM-PA`).
6. **Fiscalização Contratual, Aditivos, PAS Federativo/LINDB Art. 22, Cesta de Preços e Governança de ARP (Geração 5):**
   - `docgov_audit_contract_execution`: auditoria de limites de aditamento de 25%/50% sem compensação, consensualidade em estatais, batimento quadripartite, reajustes com interregno de 12 meses, PAS Federativo (`TCU`, `TCDF`, `TCE`, `TCM`, `CEIS`/`CNEP`/`PNCP`) com contraditório mínimo de 15 dias úteis e dosimetria LINDB Art. 22, segregação glosa ANS/IMR vs. multa (`0,5%`–`30%`), notificação de Seguro-Garantia, saneamento estatístico de cesta de preços (`CV <= 25%`), álea extraordinária e compilação OpenXML DOCX/PDF de notificações e pareceres de dosimetria.
   - `docgov_govern_arp`: governança determinística de Atas de Registro de Preços, livro-razão de caronas (50%/200%), compatibilidade jurídica/federativa e compilação de notas técnicas OpenXML.
7. **Fase Externa/Recursal, Contratação Direta & Ponte Multimodal `unpdf@2.1+` (Geração 6):**
   - `docgov_evaluate_bidding_proposals`: avaliação de TIC (UST/HST/PF/SQUAD), inexequibilidade `< 75%` e garantia adicional `75%..85%`, Jogo de Planilha, perícia forense de ACT em 7 vetores, anti-conluio em lote e fase recursal Art. 165/168.
   - `docgov_audit_direct_contracting`: auditoria de inexigibilidade (Súmula TCU 255 / 3 NFs), dispensa por valor (anti-fracionamento anual por UG e PDM/CATMAT/CATSER) e parceria estratégica de estatais (Art. 28, § 3º, II da Lei 13.303/2016).
   - Pipeline PDF `unpdf@2.1+` com classificação em 5 classes (`inspectPages`), materialização visual em `assets/` com filtro anti-brasão SHA-256 e perícia forense dual `PDF/DOCX`.

> ℹ️ **Histórico Completo de Versões Anteriores:** Para a cronologia detalhada de cada marco, patch e correção histórica (da `v0.0.1` à versão atual), consulte o arquivo canônico [`CHANGELOG.md`](CHANGELOG.md).

---

## 3. Autodescoberta, Cache Global e Recursos de Resiliência

O servidor MCP é **100% autodescritivo, autoexplicativo e dotado de inteligência estrutural nativa**:

1. **Rastreabilidade de Versão em Todos os Retornos (`v1.7.0`):** Inclusão mandatória do campo `"engine_version": "1.7.0"` na raiz do payload JSON sintético retornado por todas as **16 ferramentas MCP**.
2. **Teto Estrito de Payload MCP ($< 1024$ bytes com margem segura $< 900$ bytes):** Todo retorno de ferramenta via stdio MCP é um JSON sintético conciso, referenciando arquivos detalhados gravados em disco (`state/`).
3. **Resiliência de Diretórios e Zero ENOENT:** Criação recursiva de pastas (`mkdirSync(..., { recursive: true })`) em todas as ferramentas que gravam arquivos (`build_docx_template`, `fill_docx_template`, `generate_audit_docx`, `inspect_doc`, `bootstrap_case`, `fetch_pncp`, `fetch_juris`).
4. **Motor Híbrido de Lista Multinível Nativa:**
   - **Fora de tabelas (`<w:body>`):** Cria ou atualiza `word/numbering.xml` com definição multinível de 9 níveis decimais escalonados (`%1.`, `%1.%2.`, `%1.%2.%3.`), insere `<w:pPr><w:numPr>` com `<w:startOverride>` sincronizado com o capítulo pai e limpa o prefixo numérico literal do `<w:t>`, com herança nativa de `<w:numPr>` da árvore do template sem reset para 1.
   - **Dentro de tabelas (`<w:tc>`):** Aplica *Hanging Indent* estático (`<w:ind w:left w:hanging>` + `<w:tabs>`) separando o marcador numérico literal com `<w:r><w:tab/></w:r>`.
5. **Sanitização de Tags JS e Validação Léxica Precoce:**
   - Auto-normaliza acessos numéricos por ponto (`{{itens.0.qtd}}` $\rightarrow$ `{{itens[0].qtd}}`).
   - Valida precocemente no `build_docx_template` barrando identificadores com hífen ou dígitos iniciais com *Exact Copy-Paste Error*.
   - Desaninha (*unflatten*) chaves planas como `"itens.0.qtd": "10"` em arrays de objetos compatíveis.
6. **Rastreabilidade Temporal do Cache & Retrocompatibilidade Estrita:** Persiste e expõe `created_at`, `updated_at`, `age_days`, `cache_date_status`, `engine_version` e `slots_count` no cache global (`core/registry/templates/`), preservando o `created_at` original em atualizações.
7. **Padrão Exact Copy-Paste Error:** Validação fail-fast estrita em `slots_manifest.json` e `relatorio_auditoria.json`. Em caso de erro de contrato ou `applied_slots_count === 0`, o motor interrompe a execução com a instrução mandatória:
   > *"NÃO faça leituras exploratórias no repositório. Reescreva imediatamente o arquivo utilizando estritamente o contrato abaixo:"*
   acompanhada do snippet JSON canônico completo e pronto para copiar e colar.
8. **Exportação de Especificação Técnica Integral (`--dump-spec`):** Exporta a especificação técnica integral do motor em Markdown (UTF-8) para alinhamento instantâneo com agentes consumidores.
9. **Radar das 14 Zonas de Impugnação (`Z1` a `Z14`):** Varre as linhas de `.pdf` e `.docx` identificando atestados, prazos, garantias, marcas exclusivas, datasheets direcionados, métricas, orçamentos e cruzamento multipeça.
10. **Auto-Inspeção Integrada no Preenchimento:** O `fill_docx_template` executa automaticamente a inspeção estrutural pós-compilação gravando `state/inspecao_<stem>.json` e `state/visao_auditoria_<stem>.md`, dispensando rodar `inspect_doc` novamente.
11. **Auditoria Matemática de Planilhas Orçamentárias:** Realiza a checagem aritmética exata em centavos inteiros ($Qtd \times Unit = Total$, subtotais e total geral) e o cruzamento com menções textuais de valor global no Radar `Z10`/`Z12`, persistindo `state/auditoria_orcamentaria_<stem>.json`.
12. **Diff Estrutural e Semântico Multi-Versão:** Compara versões sucessivas de documentos através do parâmetro `compareWithPath` no `inspect_doc` ou da flag `--diff` na CLI, computando seções adicionadas/removidas/modificadas (com inline diff) e o delta de zonas de risco (`INTRODUCED`, `RESOLVED`, `RETAINED`) em `state/diff_documental_<stem>.md`.
13. **Trava Anti-Alucinação de Jurisprudência (`[ANTI_HALLUCINATION_BLOCK]`):** Bloqueio fail-fast em `fetch_juris` contra citações de julgados inventados ou inexistentes nas bases de dados oficiais dos tribunais.

---

## 4. Ciclo de Vida do Caso: 16 Ferramentas Nativas Integradas

O motor opera em dois modos (Servidor MCP por padrão ou CLI via flags), disponibilizando as **16 ferramentas fundamentais**:

### A) Modo Servidor MCP (Padrão / `--mcp`)

Ao ser executado **sem argumentos** (ou com `--mcp`), o binário inicia um servidor MCP sobre `stdio` expondo as seguintes ferramentas:

1. **`bootstrap_case`**
   - Cria a estrutura de diretórios do caso (`inputs/`, `state/`, `templates/`, `output/`, além de `assets/` quando houver imagens relevantes), preserva nomes legíveis ou auto-batiza anexos opacos (`media_*`), infere extensões via magic bytes, aceita `fileRenameMap`.
   - Descompacta pacotes compactados (`.zip`, `.tar`, `.tar.gz`, `.tgz`) via `libmagic msooxml` com defesa Anti-Zip Slip.
   - Copia de forma síncrona imediata os modelos `.docx` e documentos `.pdf` de `uploadsDir` para `inputs/`, extrai seus mapas estruturais (`state/estrutura_<nome>.json`), gera a **Visão Linear de Auditoria** (`state/visao_auditoria_<nome>.md`), o **Dossiê de Hotspots** (`state/dossie_hotspots_<nome>.md`), o relatório de **Auditoria Orçamentária** (`state/auditoria_orcamentaria_<nome>.json`, se houver tabelas de itens) e o **Índice Mestre do Caso** (`state/indice_mestre_caso.md`).
   - **Perícia Forense Dual `PDF/DOCX` & Anti-Conluio (`v1.6.2`):** Executa inventário forense cruzado de autoria, timestamps, assinaturas digitais e editores (`Canva`, `iLovePDF`, `Sejda`, `Smallpdf`, `CorelDRAW`, `Photoshop`, etc.) em `.pdf` (`getMeta`) e `.docx` (`docProps/core.xml` + `docProps/app.xml`), sinalizando autoria compartilhada entre propostas/cotações (`[BID_RIGGING_SHARED_AUTHOR_METADATA_ALERT]` / `[PRICE_QUOTATION_SHARED_METADATA_SIMULATION_BLOCK]`).
   - Parâmetros: `caseDir` (*obrigatório*), `uploadsDir` (*opcional*), `fileRenameMap` (*opcional*).

2. **`inspect_doc`**
   - Realiza a engenharia reversa de arquivos `.docx`, `.pdf`, `.xlsx`, `.csv`, `.md` ou `.txt`.
   - **Para PDF (`unpdf@2.1+` & Ponte Multimodal `assets/`):** Extrai todas as páginas, classifica-as em 5 classes via `inspectPages` (`BORN_DIGITAL`, `FULL_PAGE_SCAN`, `HYBRID_HEADER_SCAN_TRAP`, `EMBEDDED_VISUAL_ASSET`, `OCR_LAYER_EMBEDDED`), numera linhas com coordenada dupla `[PAG_XXX | LYYYY]`, reconstrói colunas com ` | `, aplica filtro anti-brasão SHA-256 materializando até `20` PNGs relevantes em `assets/<stem>/pag_XXX_img_YY.png` com âncoras `[PAG_XXX | ASSET_IMG_YY | ...]`, e constrói a Cartografia Estrutural em 3 camadas e o Radar das 14 Zonas (`Z1` a `Z14`), gerando `state/estrutura_<stem>.json`, `state/visao_auditoria_<stem>.md` e `state/dossie_hotspots_<stem>.md`.
   - **Para DOCX:** Mapeia parágrafos, tabelas, extrai metadados forenses (`docProps`), constrói `toc_map`, calcula `structure_fingerprint`, busca no Cache Global e gera `state/visao_auditoria_<stem>.md`.
   - **Auditoria Orçamentária Automática:** Realiza checagem determinística em centavos de preços e quantitativos, alimentando o Radar Z10/Z12 e gerando `state/auditoria_orcamentaria_<stem>.json`.
   - **Diff Multi-Versão (`compareWithPath`):** Quando fornecido caminho de documento anterior/retificado, calcula as divergências textuais e estruturais com delta das 14 zonas em `state/diff_documental_<stem>.md` e `.json`.
   - Parâmetros: `filePath` (*obrigatório*, com alias retrocompatível `docxPath`), `compareWithPath` (*opcional*), `outputPath` (*opcional*), `compact` (*opcional*).

3. **`build_docx_template`**
   - Transforma um `.docx` bruto (sem tags) em um template parametrizado com tags `{{...}}` a partir de um arquivo `slots_manifest.json`, preservando 100% da formatação visual (`<w:pPr>`, `<w:rPr>`, estilos, cabeçalhos e tabelas).
   - Valida fail-fast com *Exact Copy-Paste Error* contra propriedades inventadas ou `applied_slots_count === 0`.
   - Suporta `saveToRegistry: true` para homologar o template no Cache Global cross-órgão.
   - Parâmetros: `sourcePath`, `manifestPath`, `outputPath` (*obrigatórios*), `saveToRegistry` (*opcional*), `templateId` (*opcional*).

4. **`fill_docx_template`**
   - Preenche um template `.docx` parametrizado injetando os dados de um arquivo JSON de estado (`{{...}}`, loops `FOR`, condicionais `IF`, quebras `\n` em parágrafos reais, conversão de tabelas Markdown para elementos OpenXML `<w:tbl>`, negrito `**...**` e listas hierárquicas multinível híbridas).
   - **Exportação Híbrida para PDF:** Suporta `outputFormat: "docx" | "pdf" | "both"`. Em modo `"pdf"`, converte via Word COM ou Pure-JS e auto-inspeciona o PDF gerado.
   - Executa **auto-inspeção integrada**, gravando `state/inspecao_<stem>.json` e `state/visao_auditoria_<stem>.md`.
   - Parâmetros: `templatePath`, `statePath`, `outputPath` (*obrigatórios*), `autoInspect` (*opcional*), `outputFormat` (*opcional*).

5. **`generate_audit_docx`**
   - Gera um Parecer de Auditoria Técnico-Jurídica em layout editorial vertical corrido (folha A4 retrato, **zero tabelas** `<w:tbl>`, 100% da largura útil da página), com fichas individualizadas e transcrições literais de evidências.
   - **Exportação para PDF:** Suporta `outputFormat: "docx" | "pdf" | "both"`.
   - Parâmetros: `auditJsonPath`, `outputPath` (*obrigatórios*), `outputFormat` (*opcional*).

6. **`generate_technical_note_docx`**
   - Gera Nota Técnica Comparativa de Evolução Documental ('Antes vs. Depois', Marco 6) em Word (`.docx`) e PDF em layout editorial vertical corrido (folha A4 retrato, **zero tabelas** `<w:tbl>`, 100% largura útil), com destaque visual colorido por cards com bordas laterais (verde para inclusão, vermelho para supressão, azul para alteração), diff granular inline em nível de token e fundamentação técnica/jurídica individualizada por cláusula alterada.
   - **Modos Híbridos:** Suporta modo direto via `noteJsonPath` ou modo comparativo automático derivado a partir de `oldPath` e `newPath`.
   - **Exportação para PDF:** Suporta `outputFormat: "docx" | "pdf" | "both"`.
   - Parâmetros: `outputPath` (*obrigatório*), `noteJsonPath` (*opcional se oldPath/newPath fornecidos*), `oldPath` (*opcional*), `newPath` (*opcional*), `outputFormat` (*opcional*).

7. **`fetch_pncp`**
   - Conector nativo PNCP para download determinístico de contratações públicas de referência para benchmarking técnico e pesquisa de mercado (IN SEGES/ME nº 65/2021).
   - Isolamento estrito dos arquivos baixados em `cases/<slug>/inputs/pncp_<shortname>/` com descompactação automática transparente e catalogação de referência (`state/indice_pncp_<shortname>.md` e `state/pncp_<shortname>_meta.json`).
   - Parâmetros: `caseDir`, `pncpIdOrUrl` (*obrigatórios*), `shortname` (*opcional*).

8. **`search_pncp`**
   - Busca textual multi-query no endpoint oficial `/api/search/` do PNCP com desduplicação por `CNPJ/ANO/SEQUENCIAL`, acumulação em `state/pncp_search_results.json` e tabela consolidada com Objeto Completo em `state/pncp_search_results.md`.
   - Parâmetros: `caseDir`, `query` (*obrigatórios*), `status`, `uf`, `modalidade`, `limit` (*opcionais*).

9. **`search_juris`**
   - Busca sob demanda em APIs oficiais de jurisprudência (TCU, STJ, STF, TST, AGU, TCE-PA, TCM-PA, TCE-CE, TCDF, TCE-SP, TCE-MG, TCE-PR) com multi-query paralela (`|`), Statutory Bridge (Lei 13.303/2016 $\leftrightarrow$ Lei 14.133/2021), ranking determinístico (`0..100 pts`), postura tática `DEFENSE`/`ATTACK`, coexistência Estadual vs. Municipal via `sphere` (`STATE`/`MUNICIPAL`/`ALL`), auto-trigger isolado e degradação graciosa com graceful fallback por UF.
   - Persiste Ficha de Triagem Rápida em `state/juris_search_results.json` e painel em `.md` com retorno sintético MCP conciso (< 900 bytes).
   - Parâmetros: `query` (*obrigatório*), `caseDir`, `courts`, `uf`, `sphere`, `stance`, `regime`, `limit` (*opcionais*).

10. **`fetch_juris`**
    - Download oficial e fatiamento anatômico em 6 Macro-Partes / 10 Sub-Camadas pelo `AnatomicalSlicer` com trava anti-alucinação estrita (`[ANTI_HALLUCINATION_BLOCK]`).
    - Grava o Dossiê Fatiado por tópico no Estágio 2 (`state/dossie_juris_<shortname>.md`) e o Inteiro Teor Estruturado no Estágio 3 (`inputs/juris_<shortname>/inteiro_teor_anatomico.md`).
    - Parâmetros: `acordaoIdOrUrl` (*obrigatório*), `caseDir`, `court`, `shortname`, `topicFilter`, `stance` (*opcionais*).

11. **`docgov_audit_contract_execution`**
    - Auditoria determinística e fiscalização contínua de contratos administrativos: limites de aditamento (25%/50% isolados, sem compensação mútua), batimento quadripartite (`[TR <-> Proposta <-> ARP <-> Contrato/Fatura]`) com bloqueio de aditivo direto em ARP, consensualidade em estatais, reajustes/repactuações com interregno de 12 meses, PAS Federativo (`TCU`, `TCDF`, `TCE`, `TCM`, `CEIS`/`CNEP`/`PNCP`) com dosimetria LINDB Art. 22, segregação ANS/IMR vs. multa (`0,5%`–`30%`), Seguro-Garantia, cesta de preços IN 65/2021 (`CV <= 25%`) e álea extraordinária.
    - Grava `relatorio_fiscalizacao_contratual.json`, `dossie_fiscalizacao_contratual.md` e minutas OpenXML/PDF em disco com payload sintético MCP < 900 bytes.
    - Parâmetros: `contractJsonPath`, `caseDir`, `outputDir`, `auditType`, `compilationMode`, `outputFormat` (*opcionais conforme fluxo*).

12. **`docgov_govern_arp`**
    - Motor determinístico de governança de Ata de Registro de Preços e gestão de caronas: livro-razão com travas de 50% individual e 200% global acumulada, matriz de compatibilidade federativa/jurídica (vedação de carona ascendente e simetria 14.133 vs 13.303), condicionantes de TIC, auditoria de vigência (12+12m) e compilação nativa OpenXML DOCX/PDF de notas técnicas de adesão e estudos de vantajosidade.
    - Grava `dossie_governanca_arp.json`, `visao_governanca_arp.md` e minutas DOCX/PDF com payload sintético MCP < 900 bytes.
    - Parâmetros: `arpJsonPath`, `caseDir`, `outputDir`, `compilationMode`, `outputFormat` (*opcionais conforme fluxo*).

13. **`docgov_evaluate_bidding_proposals`**
    - Auditoria e julgamento de propostas na Fase Externa de TIC sem DEMO (`UST`, `HST`, `Hora-Técnica`, `PF`, `SQUADs`), presunção relativa de inexequibilidade `< 75%` e garantia adicional `75%..85%` (Art. 59 §§ 4º e 5º e Súmula TCU 262), Jogo de Planilha, conversibilidade de ACT (Súmula TCU 263), qualificação econômico-financeira (`ILG`/`ILC`/`ISG`/`EG`), conluio por metadados entre propostas concorrentes, Perícia Forense de ACT em 7 vetores e Fase Recursal administrativa (Art. 165 e Art. 168).
    - Grava dossiês JSON/MD e compila peças OpenXML/PDF (`PROPOSAL_JUDGMENT_OPINION`, `ACT_DILIGENCE_LETTER`, `APPEAL_REASONS`, `APPEAL_COUNTER_REASONS`, `PREGOEIRO_DECISION`, `APPEALS_BUNDLE`, `BOTH`, `ALL`) com payload sintético MCP < 900 bytes.
    - Parâmetros: `proposalJsonPath` (aliases `biddingJsonPath`, `bidding_json_path`, `input_json_path`), `caseDir`, `outputDir`, `evaluationStance` (`DEFENSE` | `ATTACK`), `compilationMode`, `outputFormat`.

14. **`docgov_audit_direct_contracting`**
    - Auditoria determinística de Contratação Direta: Inexigibilidade (Art. 74, Súmula TCU 255, exigência de 3 NFs/contratos do fornecedor e bloqueio de sobrepreço), Dispensa por Valor com controle anti-fracionamento anual por UG e PDM/CATMAT/CATSER, e Oportunidade de Negócio / Parceria Estratégica em Estatais (Art. 28, § 3º, II da Lei nº 13.303/2016), com detecção de cotações simuladas por metadados compartilhados.
    - Grava dossiês JSON/MD e compila o Parecer de Instrução Processual OpenXML/PDF (`DIRECT_CONTRACTING_OPINION`) com payload sintético MCP < 900 bytes.
    - Parâmetros: `directContractingJsonPath` (aliases `directJsonPath`, `direct_json_path`, `input_json_path`), `caseDir`, `outputDir`, `compilationMode`, `outputFormat`.

15. **`docgov_audit_demo_regime`**
    - Auditoria determinística em centavos inteiros de Planilhas de Custos (`Módulos 1 a 6` do Anexo VII-D da IN SEGES nº 05/2017) e governança contratual do Regime `DEMO`: piso CCT, Súmula 448 TST, SAT/RAT × FAP, VT 6%/VA, APT `<= 1,94%`, Gross-Up, alíquota efetiva EFD no Lucro Real (Acórdão TCU 1.214/2013), vedação ao Simples Nacional Art. 17 XII LC 123/2006 (salvo Anexo IV Limpeza/Vigilância com 20% CPP), produtividade `m²` Anexo VI-B, Decreto Federal nº 12.174/2024, expurgo de 90% do APT na 1ª prorrogação (Acórdão TCU 1.586/2018), Conta-Depósito Vinculada (Anexo XII) vs. Fato Gerador e Repactuação Anual por CCT (Art. 135).
    - Grava `demo_regime_audit.json`, `demo_regime_audit.md`, `laudo_pericial_planilha_demo.docx` e `laudo_pericial_planilha_demo.pdf` em `workspace_dir` com guarda estrita `<= 880B` no envelope sintético MCP.
    - Parâmetros: `demoJsonPath` (ou `inputPath` / objeto `DemoRegimeAuditInput`), `workspaceDir` (`workspace_dir`), `outputFormat`.

16. **`docgov_audit_engineering_works`**
    - Auditoria determinística de Obras e Serviços de Engenharia: quartis e fórmula algébrica do BDI (Acórdão TCU nº 2.622/2013), BDI Diferenciado para materiais/equipamentos (Súmula TCU nº 253), bloqueio de *bis in idem* de Administração Local/Canteiro/Mobilização no BDI, vedação de IRPJ/CSLL (Súmula TCU nº 254), medição proporcional da Administração Local, Curva ABC contra medianas `SINAPI`/`SICRO` (Decreto nº 7.983/2013), simetria tributária Com/Sem Desoneração CPRB (Lei nº 14.973/2024), detector de *front-loading* no cronograma, Matriz de Riscos em Contratação Integrada/Semi-Integrada e inexequibilidade `75%`/`85%` + Jogo de Planilha.
    - Grava `engineering_works_audit.json`, `engineering_works_audit.md`, `laudo_pericial_obras_engenharia.docx` e `laudo_pericial_obras_engenharia.pdf` em `workspace_dir` com guarda estrita `<= 880B` no envelope sintético MCP.
    - Parâmetros: `engineeringJsonPath` (ou `inputPath` / objeto `EngineeringWorksAuditInput`), `workspaceDir` (`workspace_dir`), `outputFormat`.

---

### B) Modo CLI (Linha de Comando)

```powershell
# 1. Inicializar pasta do caso, copiar uploads e inspecionar documentos (.docx e .pdf)
./docgov-engine --bootstrap-case --case-dir cases/caso_exemplo --uploads-dir .user_uploaded

# Com mapeamento explícito de nomes de arquivos
./docgov-engine --bootstrap-case --case-dir cases/caso_exemplo --uploads-dir .user_uploaded --rename-map '{"media_1792069974647_14a93b9d": "Edital_Pregao.pdf"}'

# 2. Inspecionar estrutura de um arquivo (.docx ou .pdf) gerando Cartografia, Radar Z1..Z14, Auditoria Orçamentária e Dossiê
./docgov-engine --inspect edital_licitacao.pdf --out state/estrutura_edital.json
./docgov-engine --inspect modelo_etp.docx --out state/estrutura_etp.json --compact

# Inspecionar comparando com versão anterior (Diff Estrutural e Semântico Multi-Versão)
./docgov-engine --inspect edital_v2.pdf --diff edital_v1.pdf

# 3. Construir template parametrizado a partir de um .docx bruto + slots_manifest.json
./docgov-engine --build-template --source modelo_etp.docx --manifest slots_manifest.json --out template.docx --save-to-registry --template-id etp_padrao_v1

# 4. Preencher template com o JSON de estado (gerando .docx e/ou .pdf)
./docgov-engine --inject --template template.docx --state estado_caso.json --out minuta_final.docx
./docgov-engine --inject --template template.docx --state estado_caso.json --out minuta_final.docx --format both
./docgov-engine --inject --template template.docx --state estado_caso.json --out minuta_final.pdf --format pdf

# 5. Gerar Parecer de Auditoria em Word (.docx) ou PDF a partir do JSON de auditoria
./docgov-engine --generate-audit-docx --audit-json state/relatorio_auditoria.json --out output/Relatorio_Auditoria_ETP.docx
./docgov-engine --generate-audit-docx --audit-json state/relatorio_auditoria.json --out output/Relatorio_Auditoria_ETP.pdf --format pdf

# 6. Gerar Nota Técnica Comparativa de Evolução de Cláusulas (Marco 6)
# 6a. Comparando arquivos diretamente (DOCX ou PDF)
./docgov-engine --diff-report --old inputs/minuta_v1.docx --new inputs/minuta_v2.docx --out output/Nota_Tecnica.docx --format both
# 6b. A partir de JSON estruturado de nota técnica
./docgov-engine --generate-technical-note --note-json state/nota_tecnica.json --out output/Nota_Tecnica.docx --format pdf

# 7. Consultar Editais e Contratações Públicas no PNCP (Geração 4)
./docgov-engine --search-pncp --case-dir cases/caso_exemplo --query "notebooks educacionais" --uf SP --limit 10
./docgov-engine --fetch-pncp --case-dir cases/caso_exemplo --pncp "00394460000141-1-000001/2026" --shortname edital_pncp

# 8. Pesquisar e Extrair Jurisprudência com Análise Anatômica (Geração 4)
# 8a. Pesquisa federada com ranking por relevância, postura tática e Statutory Bridge
./docgov-engine --search-juris --query "padronização de marca TI" --courts "TCU,STJ,STF,TCE-PA" --stance DEFENSE --regime BOTH
./docgov-engine --search-juris --query "sobrepreço BDI engenharia" --uf PA --limit 5

# 8b. Resolução canônica de acórdão e fatiamento anatômico estrutural (RELATORIO, VOTO, DISPOSITIVO)
./docgov-engine --fetch-juris --court TCU --id "Acórdão 1234/2023 - Plenário"
./docgov-engine --fetch-juris --court STJ --id "REsp 1.987.654/DF" --topic "vantajosidade econômica"

# 9. Exportar especificação técnica normativa em Markdown
./docgov-engine --dump-spec especificacao_motor.md

# 10. Verificar / Atualizar o próprio binário
./docgov-engine --check-update
./docgov-engine --update
./docgov-engine --force-update

# 11. Auditar Execução Contratual, PAS Federativo, ANS/IMR e Cesta IN 65/2021 (Geração 5)
./docgov-engine audit-contract --contract-json state/contrato_execucao.json --type FULL --mode BOTH --format both --output-dir state/

# 12. Governar Ata de Registro de Preços, Caronas e Vantajosidade (Geração 5)
./docgov-engine govern-arp --arp-json state/arp_registro.json --mode ARP_ADHESION_GRANT_NOTE --format both --output-dir state/

# 13. Avaliar Propostas de Licitação, TIC, Inexequibilidade, Conluio e Recursos (Geração 6)
./docgov-engine evaluate-proposals --bidding-json state/licitacao_propostas.json --stance DEFENSE --mode PROPOSAL_JUDGMENT_OPINION --format both --output-dir state/

# 14. Auditar Contratação Direta — Dispensa, Inexigibilidade e Parcerias Estatais (Geração 6)
./docgov-engine audit-direct-contracting --direct-json state/contratacao_direta.json --mode DIRECT_CONTRACTING_OPINION --format both --output-dir state/

# 15. Auditar Planilha de Custos e Execução Contratual em Regime DEMO (Geração 6.5 — Eixo 1)
./docgov-engine audit-demo-regime --input state/demo_regime_input.json --workspace state/ --format both

# 16. Auditar Obras e Serviços de Engenharia — BDI 2.622/2013, SINAPI/SICRO, CPRB e Cronograma (Geração 6.5 — Eixo 2)
./docgov-engine audit-engineering-works --input state/engineering_works_input.json --workspace state/ --format both

# Verificar a versão instalada e exibir ajuda
./docgov-engine -v
./docgov-engine -h
```

| Parâmetro | Descrição |
| :--- | :--- |
| *(sem argumentos)* ou `--mcp` | Inicia o servidor MCP via `stdio` (comportamento padrão). |
| `--dump-spec [caminho.md]` | Exporta a especificação técnica integral do motor em Markdown (UTF-8). |
| `--bootstrap-case` | Cria `inputs/`, `state/`, `templates/`, `output/` em `--case-dir`, copia e inspeciona `.docx` e `.pdf` imediatamente, gerando a Cartografia, o Radar Z1..Z14, o Dossiê de Hotspots e o Índice Mestre. |
| `--wait` | Aguarda a conclusão da cópia dos arquivos pesados em segundo plano no `--bootstrap-case`. |
| `--inspect <arq.docx\|.pdf>` | Extrai mapa estrutural (`state/estrutura_<stem>.json`), gera `state/visao_auditoria_<stem>.md`, `state/dossie_hotspots_<stem>.md`, executa auditoria orçamentária e busca no Cache Global. |
| `--diff <caminho>` | Compara o documento inspecionado com versão anterior/retificada gerando `state/diff_documental_<stem>.md` e `.json` (usado com `--inspect`). |
| `--compact` | Filtra parágrafos e células vazias no `--inspect` preservando os índices originais 0-based. |
| `--build-template` | Gera um template `.docx` parametrizado a partir de `--source`, `--manifest` e `--out`. |
| `--save-to-registry` | Persiste o manifesto homologado no Cache Global de templates (`core/registry/templates/`). |
| `--template-id <id>` | Identificador semântico customizado do template ao salvar no registro (opcional). |
| `--inject` | Preenche um template `.docx` a partir de `--template`, `--state` e `--out`. |
| `--generate-audit-docx` | Gera um parecer de auditoria executivo a partir de `--audit-json` e `--out`. |
| `--diff-report` | Orquestra a geração de Nota Técnica Comparativa a partir de `--old` e `--new` para `--out`. |
| `--generate-technical-note` | Gera a Nota Técnica Comparativa a partir de `--note-json` e `--out`. |
| `--search-pncp` | Executa busca textual e facetada de contratações públicas no PNCP a partir de `--query` e `--case-dir`. |
| `--fetch-pncp` | Obtém metadados, itens e arquivos de uma contratação específica no PNCP via `--pncp`. |
| `--search-juris` | Executa busca jurisprudencial federada multissistema com relevância, controvérsia e ponte normativa. |
| `--fetch-juris` | Resolução canônica e fatiamento anatômico estrutural de acórdão via `--id` (e opcionalmente `--court`). |
| `--audit-contract` / `audit-contract` | Executa auditoria determinística de execução contratual, aditivos de 25%/50% sem compensação, reajustes, batimento quadripartite, PAS Federativo e cesta de preços a partir de `--contract-json`. |
| `--govern-arp` / `govern-arp` | Executa governança de Ata de Registro de Preços, livro-razão de caronas (50%/200%), compatibilidade jurídica e compilação de notas técnicas a partir de `--arp-json`. |
| `--evaluate-proposals` / `evaluate-proposals` | Avalia propostas na fase externa (TIC sem DEMO, inexequibilidade 75%/85%, Jogo de Planilha, perícia de ACT em 7 vetores, anti-conluio e fase recursal Art. 165/168) a partir de `--bidding-json`. |
| `--audit-direct-contracting` / `audit-direct-contracting` | Audita contratação direta (inexigibilidade Súmula TCU 255, dispensa anti-fracionamento por UG/PDM e parceria estratégica Art. 28, § 3º, II da Lei 13.303) a partir de `--direct-json`. |
| `--audit-demo-regime` / `audit-demo-regime` | Audita planilhas de custos DEMO (Módulos 1–6, Anexo VI-B, Decreto 12.174/2024) e execução (APT Acórdão 1.586/2018, Conta Vinculada/Fato Gerador e Repactuação Art. 135) a partir de `--input <path_or_json>` e `--workspace <dir>`. |
| `--audit-engineering-works` / `audit-engineering-works` | Audita Obras e Serviços de Engenharia (BDI Acórdão TCU 2.622/2013, Súmulas 253/254, Curva ABC SINAPI/SICRO, CPRB Lei 14.973/2024, front-loading, Contratação Integrada e inexequibilidade 75%/85%) a partir de `--input <path_or_json>` e `--workspace <dir>`. |
| `--contract-json <caminho>` | Caminho do arquivo JSON de dados contratuais para auditoria (usado com `audit-contract`; aliases `--input`, `--contract`). |
| `--arp-json <caminho>` | Caminho do arquivo JSON da Ata de Registro de Preços para governança (usado com `govern-arp`; aliases `--input`, `--arp`). |
| `--bidding-json <caminho>` | Caminho do arquivo JSON da licitação/propostas/recursos (usado com `evaluate-proposals`; aliases `--proposal-json`, `--input`). |
| `--direct-json <caminho>` | Caminho do arquivo JSON da contratação direta (usado com `audit-direct-contracting`; aliases `--direct-contracting-json`, `--input`). |
| `--type <tipo>` | Tipo de auditoria contratual (`FULL`, `ADDENDUM_LIMITS`, `TRIPARTITE_MATCH`, `READJUSTMENT`, `PAS_SANCTIONS`, `PRICE_BASKET` — padrão: `FULL`). |
| `--mode <modo>` | Modo de compilação documental: `audit-contract` (`NONE`, `PAS_NOTIFICATION`, `SANCTION_DOSIMETRY_OPINION`, `DOSIMETRY_OPINION`, `BOTH`); `govern-arp` (`ARP_ADHESION_GRANT_NOTE`, `ARP_ADVANTAGE_STUDY`, `GRANT_NOTE`, `ADVANTAGE_STUDY`, `NONE`); `evaluate-proposals` (`PROPOSAL_JUDGMENT_OPINION`, `ACT_DILIGENCE_LETTER`, `BOTH`, `APPEAL_REASONS`, `APPEAL_COUNTER_REASONS`, `PREGOEIRO_DECISION`, `APPEALS_BUNDLE`, `ALL`, `NONE`); `audit-direct-contracting` (`DIRECT_CONTRACTING_OPINION`, `NONE`). |
| `--output-dir <dir>` | Diretório de destino para gravação de relatórios e artefatos em disco (usado com `audit-contract`, `govern-arp`, `evaluate-proposals` e `audit-direct-contracting`). |
| `--query <termo>` | Termo ou expressão de busca textual (usado com `--search-pncp` e `--search-juris`). |
| `--pncp <id_ou_url>` | Identificador PNCP canônico (`CNPJ-tipo-sequencial/ano`) ou link da contratação no PNCP. |
| `--courts <lista>` | Lista de cortes separada por vírgula para consulta jurisprudencial (ex.: `TCU,STJ,STF,TST,AGU,TCE-PA,TCM-PA,TCE-CE,TCDF,TCE-SP,TCE-MG,TCE-PR`). |
| `--court <id>` | Sigla da corte/tribunal de destino (usado com `--fetch-juris`). |
| `--uf <UF>` | Sigla da Unidade Federativa para filtro territorial no PNCP ou resolução automática no Juris (suporta também código direto de corte como `TCM-PA`). |
| `--sphere <esfera>` | Esfera subnacional no `--search-juris` (`STATE`, `MUNICIPAL`, `ALL` — padrão: `STATE`). |
| `--id <acordao>` | Identificador ou citação canônica do acórdão/processo (usado com `--fetch-juris`). |
| `--stance <postura>` | Postura tática no `--search-juris`, `--fetch-juris` e `evaluate-proposals` (`DEFENSE`, `ATTACK`, `BOTH`; na ferramenta `evaluate-proposals`: `DEFENSE`, `ATTACK`). |
| `--regime <lei>` | Filtro de regime licitatório no `--search-juris` (`13303`, `14133`, `BOTH`). |
| `--shortname <nome>` | Prefixo ou apelido legível para os arquivos gravados no caso. |
| `--topic <termo>` | Tópico temático de interesse para focar o fatiamento anatômico no `--fetch-juris`. |
| `--limit <n>` | Limite máximo de registros a retornar na consulta (padrão: 10). |
| `--old <caminho>` | Caminho do documento base/anterior (.docx, .pdf ou .json) usado com `--diff-report`. |
| `--new <caminho>` | Caminho do documento revisado/novo (.docx, .pdf ou .json) usado com `--diff-report`. |
| `--note-json <caminho>` | Caminho do arquivo `nota_tecnica.json` (usado com `--generate-technical-note`). |
| `--data <caminho>` | Caminho de dados adicionais/justificativas JSON para enriquecer o `--diff-report` (opcional). |
| `--format <docx\|pdf\|both>` | Seleciona o formato de saída nos comandos `--inject`, `--generate-audit-docx`, `--diff-report`, `--generate-technical-note`, `audit-contract`, `govern-arp`, `evaluate-proposals`, `audit-direct-contracting`, `audit-demo-regime` e `audit-engineering-works`. |
| `--case-dir <dir>` | Caminho da pasta do caso (usado com `--bootstrap-case`, `--search-pncp`, `--fetch-pncp`, etc.). |
| `--uploads-dir <dir>` | Caminho opcional da pasta `.user_uploaded` (usado com `--bootstrap-case`). |
| `--audit-json <caminho>` | Caminho do arquivo `relatorio_auditoria.json` (usado com `--generate-audit-docx`). |
| `--source <caminho>` | Caminho do `.docx` bruto original (usado com `--build-template` ou `--inspect`). |
| `--manifest <caminho>` | Caminho do arquivo `slots_manifest.json` (usado com `--build-template`). |
| `--template <caminho>` | Caminho do arquivo modelo `.docx` de entrada (usado com `--inject`). |
| `--state <caminho>` | Caminho do arquivo `.json` contendo os dados a serem injetados (usado com `--inject`). |
| `--out <caminho>` | Caminho do arquivo de saída. |
| `--check-update` | Consulta o GitHub Releases e informa se há uma nova versão disponível. |
| `-u`, `--update` | Atualiza o próprio binário para a versão mais recente. |
| `--force-update` | Força o download e substituição do binário pela última release publicada. |
| `-v`, `--version` | Exibe a versão atual do binário (`docgov-engine vX.Y.Z`). |
| `-h`, `--help` | Exibe o resumo de uso e parâmetros disponíveis. |

---

## 5. Estrutura do `slots_manifest.json` (`build_docx_template`)

O motor suporta tanto a **notação compacta universal** (baseada nas coordenadas do `toc_map` e `visao_auditoria.md`) quanto a **notação canônica verbosa**, sempre com nomes de variáveis em `snake_case` e suporte automático a acessos indexados (`itens[0].qtd`):

### A) Notação Compacta Universal (Recomendada)
```json
{
  "slots": [
    { "coord": "P3", "tag": "{{estudo.descricao_necessidade}}" },
    { "coord": "T0.R0.C1", "tag": "{{metadados.unidade_requisitante}}" },
    { "coord": "T1.R1.C1", "tag": "{{itens[0].descricao}}: {{itens[0].qtd}} unidades" },
    { "coord": "P12-P14", "tag": "{{estudo.justificativa}}" },
    { "find": "Texto Antigo Fixo", "replace": "{{metadados.orgao}}" }
  ]
}
```
> **Dica:** Aceita coordenadas com ou sem colchetes (`"T0.R0.C1"` ou `"[T0.R0.C1]"`), ranges de parágrafo (`"P12-P14"`), aliases (`col_index`, `paragraph_index`), auto-conversão de `itens.0.qtd` para `itens[0].qtd` e array puro na raiz `[ { "coord": "...", "tag": "..." } ]`.

### B) Notação Canônica Detalhada
```json
{
  "replace_paragraphs": [
    {
      "start_p": 3,
      "end_p": 5,
      "tag": "{{estudo.descricao_necessidade}}"
    }
  ],
  "replace_table_cells": [
    {
      "table_index": 0,
      "row_index": 0,
      "cell_index": 1,
      "tag": "{{metadados.unidade_requisitante}}"
    },
    {
      "table_index": 1,
      "row_index": 1,
      "cell_index": 1,
      "tag": "{{itens[0].descricao}}: {{itens[0].qtd}}"
    }
  ],
  "loop_table_rows": [
    {
      "table_index": 1,
      "header_row_index": 0,
      "template_row_index": 1,
      "remove_from_row": 2,
      "remove_to_row": 6,
      "for_open_tag": "{{FOR r IN gestao_riscos}}",
      "for_close_tag": "{{END-FOR r}}",
      "cell_tags": ["{{$r.risco}}", "{{$r.mitigacao}}"]
    }
  ],
  "replace_inline": [
    {
      "find": "Texto Antigo Fixo",
      "replace": "{{metadados.orgao}}"
    }
  ]
}
```

---

## 6. Configuração nos Principais Agentes MCP

Como o modo MCP é o padrão quando nenhum argumento é passado, basta apontar para o executável:

### Google Antigravity (AGY)
Edite `~/.gemini/config/mcp_config.json` (ou acesse **Additional Options (...) > MCP Servers**):
```json
{
  "mcpServers": {
    "docgov": {
      "command": "C:/caminho/para/docgov-engine.exe",
      "args": []
    }
  }
}
```

### Claude Code (CLI)
```powershell
# Windows
claude mcp add docgov -- "C:\caminho\para\docgov-engine.exe"

# Linux / macOS
claude mcp add docgov -- "/caminho/para/docgov-engine"
```

### Claude Desktop / Cursor / Windsurf
No arquivo `claude_desktop_config.json`, `.cursor/mcp.json` ou `~/.codeium/windsurf/mcp_config.json`:
```json
{
  "mcpServers": {
    "docgov": {
      "command": "C:/caminho/para/docgov-engine.exe",
      "args": []
    }
  }
}
```

---

## 7. Desenvolvimento, Testes e Governança

O desenvolvimento e a validação do `docgov-engine` utilizam o runtime [Bun](https://bun.sh/).

### Instalação de Dependências
```bash
bun install
```

---

### A) Testes Unitários e Herméticos (100% Offline e Determinístico)

A suíte hermética é rápida, isolada e não faz chamadas externas de rede, garantindo reprodução instantânea em qualquer ambiente:

```bash
# Executar a bateria completa de testes herméticos e contratos locais
bun test
```

#### Comandos Seletivos por Domínio (Copiar e Colar)

Para focar no domínio em desenvolvimento ou acelerar ciclos de micro-commit, execute apenas a suíte correspondente:

```bash
# 0. Auditoria física de linhas (Lei 9 <= 500 linhas em: src/tools/juris, src/utils/pdf, src/contracts, src/arp, src/bidding, src/direct_contracting, test, tests_live e scripts)
bun run check:lines

# 1. Jurisprudência (Core/Scorer, Roteamento/Tools, Slicer Anatômico, Cortes Federais e Cortes Estaduais)
bun test test/juris/core_and_scorer.test.ts test/juris/routing_and_tools.test.ts test/juris/anatomical_slicer.test.ts
bun test test/juris/federal_courts.test.ts
bun test test/juris/state_courts.test.ts
bun test test/juris/state_courts.test.ts -t "TCE-MG"

# 2. Portal Nacional de Contratações Públicas (PNCP)
bun test test/pncp_search.test.ts test/pncp_fetch.test.ts

# 3. Ingestão de Pastas, Bootstrap de Casos e Salvaguardas
bun test test/bootstrap.test.ts test/bootstrap_guardrails.test.ts

# 4. Inspeção Estrutural, Cartografia de Documentos e Radar Z1..Z14
bun test test/inspect.test.ts test/inspect_text_md.test.ts

# 5. Auditoria Orçamentária e Análise de Planilhas
bun test test/budget_auditor.test.ts test/spreadsheet.test.ts

# 6. Engenharia Reversa e Preenchimento de Templates OpenXML
bun test test/build_template_contracts.test.ts test/build_template_tables.test.ts
bun test test/fill_template_injection.test.ts test/fill_template_multilevel.test.ts

# 7. Parecer de Auditoria Executivo e Notas Técnicas Comparativas
bun test test/audit.test.ts test/technical_note.test.ts

# 8. Comparador Documental e Diff Estrutural / Semântico Multi-Versão
bun test test/structural_diff.test.ts test/semantic_diff.test.ts

# 9. Pipeline Híbrido de Exportação DOCX -> PDF (Pure-JS + Word COM)
bun test test/pdf_exporter.test.ts

# 10. Cache Global de Templates e Registro de Minutas
bun test test/registry.test.ts test/registry_matching.test.ts

# 11. Dispatcher MCP (JSON-RPC stdio), Governança de Versão/Lockstep e Self-Discovery Normativo
bun test test/mcp_dispatch.test.ts test/mcp_spec.test.ts test/version.test.ts

# 12. Fiscalização Contratual, PAS Federativo/LINDB Art. 22, Cesta IN 65/2021 e Governança de ARP (Geração 5)
bun test test/contracts/ test/arp/ test/contracts_arp_mcp_cli.test.ts

# 13. Fase Externa/Recursal, Contratação Direta & Ponte Multimodal unpdf@2.1+ / Perícia Criptográfica PAdES, NF-e & w:rsid/XLSX (Gen6/Gen7.0)
bun test test/bidding_gen6.test.ts test/bidding_inexeq_appeals_v164.test.ts test/direct_contracting_gen6.test.ts test/pdf_unpdf_v2_multimodal_forensics.test.ts test/pades_signature_auditor.test.ts test/nfe_key_validator.test.ts test/rsid_and_xlsx_forensics.test.ts
```

---

### B) Sondas Online de Contrato de API (Live API Smoke Tests)

As suítes de **Live Smoke Tests** executam requisições HTTPS REAIS contra os portais públicos oficiais (`pncp.gov.br`, `api.github.com` e portais de tribunais), atestando a conectividade, a conformidade de schemas e a resiliência contra mudanças de APIs públicas.

#### Execução Geral ou por Suíte
```bash
# Executar todas as sondas de rede (PNCP + GitHub + Jurisprudência)
bun run test:live

# Executar a suíte de Jurisprudência com Auto-Discovery Dinâmico (todos os 11 conectores + Fallback gracioso = 23 sondas)
bun run test:live:juris

# Executar apenas as sondas da API oficial do PNCP (pncp.gov.br)
bun run test:live:pncp

# Executar apenas as sondas do GitHub Updater e Checksums
bun run test:live:updater
```

#### 🔍 Rastreabilidade e Diagnóstico Real de Origem no Relatório Executivo
O runner `test:live:juris` avalia cada conector e explicita no relatório executivo o diagnóstico exato da resposta:
- `[API Live Direta]`: Resposta obtida diretamente da API REST/JSON ou portal web oficial do tribunal;
- `[Híbrido (Live + Curado)]`: Resultados combinados entre a API oficial ao vivo e o catálogo normativo local;
- `[Fallback Curado Local]`: Atendimento pelo catálogo determinístico curado (Súmulas/Consultas/Orientações Normativas) quando o portal externo exige sessão/CAPTCHA ou a query foca em enunciados sumulados;
- `[Catálogo Normativo Curado]`: Extração e fatiamento anatômico de enunciado normativo curado em `fetchJuris`;
- `[Graceful Fallback]`: Confirmação de degradação graciosa para UF não implementada (ex.: `AC`), acionando a camada federal e gerando `fallback_notice`.

#### 🚀 Isolamento Cirúrgico por Tribunal (`--court=<ID>`) (Copiar e Colar)

Para auditar individualmente um único conector (ou grupo de cortes) sem executar consultas contra as demais, utilize o runner com a flag `--court` (< 3s por corte):

```bash
# Tribunal de Contas da União (TCU)
bun scripts/run_live_tests.ts --suite=juris --court=TCU

# Superior Tribunal de Justiça (STJ)
bun scripts/run_live_tests.ts --suite=juris --court=STJ

# Supremo Tribunal Federal (STF)
bun scripts/run_live_tests.ts --suite=juris --court=STF

# Tribunal Superior do Trabalho (TST — Terceirização e Súmula 331)
bun scripts/run_live_tests.ts --suite=juris --court=TST

# Advocacia-Geral da União (AGU — Pareceres Vinculantes, Orientações Normativas e Súmulas)
bun scripts/run_live_tests.ts --suite=juris --court=AGU

# Tribunal de Contas do Estado do Pará (TCE-PA)
bun scripts/run_live_tests.ts --suite=juris --court=TCE-PA

# Tribunal de Contas do Estado do Ceará (TCE-CE)
bun scripts/run_live_tests.ts --suite=juris --court=TCE-CE

# Tribunal de Contas do Distrito Federal (TCDF)
bun scripts/run_live_tests.ts --suite=juris --court=TCDF

# Tribunal de Contas do Estado de São Paulo (TCE-SP — Súmulas e Decisões)
bun scripts/run_live_tests.ts --suite=juris --court=TCE-SP

# Tribunal de Contas do Estado de Minas Gerais (TCE-MG — Súmulas e Consultas Normativas)
bun scripts/run_live_tests.ts --suite=juris --court=TCE-MG

# Tribunal de Contas do Estado do Paraná (TCE-PR — Prejulgados, Súmulas e Consultas)
bun scripts/run_live_tests.ts --suite=juris --court=TCE-PR

# Tribunal de Contas dos Municípios do Estado do Pará (TCM-PA — 1º Conector Municipal da Onda 3)
bun scripts/run_live_tests.ts --suite=juris --court=TCM-PA

# Multi-Corte (Filtro por lista separada por vírgula)
bun scripts/run_live_tests.ts --suite=juris --court=TCE-PA,TCM-PA,TCE-PR

# Execução explícita de todas as cortes via flag
bun scripts/run_live_tests.ts --suite=juris --court=ALL
```

---

### C) Compilação Local e Self-Discovery

```bash
# Consolidação Completa: Compila Linux e Windows, normaliza binários, gera SHA256SUMS.txt e atualiza docs/especificacao_motor.md
bun run build

# Regenerar diretamente a especificação técnica normativa (--dump-spec)
bun run dump:spec

# Compilar binário isolado para a plataforma atual (opcional)
bun run build:windows
bun run build:linux
```

> ℹ️ **Nota de Distribuição & Release:** Os comandos locais `bun run build` e `bun run build:*` destinam-se a desenvolvimento local e smoke tests. A compilação oficial multi-plataforma (`ubuntu-24.04` e `windows-latest`), o cálculo de checksums (`SHA256SUMS.txt`) e a publicação de releases são **100% automatizados pela esteira externa de CI/CD** ao receber o push de tags anotadas `v*`.

---

### Estatuto de Governança (`AGENTS.md`)

O desenvolvimento do motor é estritamente regido pelas **9 Leis Invioláveis de Engenharia**:

1. **Runtime e Testes Padronizados via Bun:** Todos os comandos e testes utilizam Bun (`bun test`). Zero caminhos absolutos hardcoded no repositório.
2. **Teto Estrito de Payload MCP (< 1024 bytes):** Respostas sintéticas de ferramentas via `stdio` MCP mantêm-se abaixo de 1024 bytes (margem segura $< 920$ bytes) para prevenir truncamento em IDEs consumidoras. Dossiês e mapas completos são persistidos em disco.
3. **Padrão Exact Copy-Paste Error:** Proibido retornar `success` com 0 alterações aplicadas. Detecções de violação de contrato abortam imediatamente fornecendo o snippet canônico exato pronto para substituição.
4. **Sincronia Obrigatória de Self-Discovery:** Qualquer alteração em ferramentas ou parâmetros atualiza no mesmo commit: `--dump-spec`, `DOCX_ENGINE_INSTRUCTIONS`, `getMcpToolsDefinition()` e dicas contextuais.
5. **Neutralidade Institucional Absoluta:** Proibido utilizar nomes ou identificadores de órgãos, entidades ou localidades específicas em código, fixtures ou testes. Apenas identificadores genéricos universais (`ORGAO_CONTRATANTE`, `TCU`, `AGU`, etc.).
6. **Resiliência de Caminhos e Cache Global:** Resolução de diretórios independente de `process.cwd()`, com fallback para `DOCGOV_REGISTRY_DIR` e sanity checks contra entradas corrompidas.
7. **Ritual de Qualidade e Release Automatizada via Pipeline Externo:** Zero releases locais (`gh release create` local proibido). Push da tag anotada `v*` como gatilho canônico exclusivo para runners remotos de CI/CD.
8. **Disciplina Autônoma de Micro-Commits Atômicos:** Todo avanço é fatiado em micro-commits sequenciais (`feat`, `fix`, `test`, `docs`) 100% verdes, com atualização contínua de `CHANGELOG.md` e `ROADMAP.md`.
9. **Modularidade Estrita, Teto de 500 Linhas e Economia de Tokens:** Nenhum arquivo `.ts` em `src/` ultrapassa 500 linhas. Leitura fatiada (*target-lines only*) e execução cirúrgica de testes durante ciclos intermediários.
