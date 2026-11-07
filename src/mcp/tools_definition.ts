// ============================================================================
// Definições de Ferramentas e Prompts MCP (docgov-engine v1.4.1)
// ============================================================================

export function getMcpPromptsDefinition() {
  return [
    {
      name: "docx_workflow_guide",
      description:
        "Guia canônico e manual de arquitetura do docgov-engine: ordem do pipeline (1..5), sintaxe de tags, estrutura do slots_manifest.json e boas práticas de injeção.",
      arguments: [],
    },
  ];
}

export function getMcpToolsDefinition() {
  return [
    {
      name: "bootstrap_case",
      description:
        "Cria a estrutura de pastas do caso (inputs/, state/, templates/, output/), descompacta e ingere automaticamente pacotes compactados (.zip, .tar, .tar.gz, .tgz) presentes em uploadsDir, na raiz do caso ou em inputs/ (com classificação libmagic msooxml, defesa Anti-Zip Slip e achatamento seguro), preserva nomes legíveis ou auto-batiza anexos opacos (media_*) com tipo semântico e hash curto (ex.: ETP_ORGAO_A_3b9d.docx), infere extensões via magic bytes (PK\\x03\\x04 e %PDF), aceita 'fileRenameMap' opcional, copia e inspeciona imediatamente arquivos .docx, .pdf (com pipeline OCR headless em páginas escaneadas) e planilhas nativas .xlsx/.csv em inputs/, submetendo-as ao budget_auditor matemático, detectando páginas escaneadas como imagem ('scanned_pages_detected'), salvando mapas estruturais em state/estrutura_<nome>.json, visões lineares em state/visao_auditoria_<nome>.md com Cartografia Estrutural (outline_headings, page_signals) e Radar das 14 Zonas de Impugnação (Z1..Z14), dossiês cirúrgicos em state/dossie_hotspots_<nome>.md e consolidando o Índice Cartográfico Mestre Unificado em state/indice_mestre_caso.md.\n" +
        "- Quando usar (Pré-condição): Primeiro passo obrigatório no ciclo de vida de qualquer caso/processo no DocGov.\n" +
        "- Quando NÃO usar (Fora de Escopo): Proibido chamar fora de diretórios de caso 'cases/<slug>/'. Esta ferramenta é restrita ao fluxo de trabalho do ecossistema DocGov.\n" +
        "- Pós-condição & Próximo Passo: Pastas criadas, pacotes descompactados, arquivos batizados e documentos inspecionados.",
      inputSchema: {
        type: "object",
        required: ["caseDir"],
        properties: {
          caseDir: {
            type: "string",
            description:
              "Caminho absoluto ou relativo da pasta raiz do caso (ex.: 'cases/caso_exemplo').",
          },
          uploadsDir: {
            type: "string",
            description:
              "Caminho opcional da pasta contendo os uploads originais do usuário.",
          },
          fileRenameMap: {
            type: "object",
            description:
              "Mapeamento explícito opcional de nomes de arquivos originais para nomes canônicos.",
            additionalProperties: { type: "string" },
          },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "inspect_doc",
      description:
        "Realiza a engenharia reversa estrutural completa de documentos individuais Word (.docx), PDF (.pdf com agrupamento Y e colunas), planilhas Excel (.xlsx com indexação exata por r='A1'), CSV (.csv) ou textos/markdown (.md/.txt), com guardrail fail-fast que rejeita pacotes compactados (.zip, .tar) orientando o uso de 'bootstrap_case', com fusão multi-página, resolução de células multilinha, pipeline OCR headless automático em páginas escaneadas ('scanned_pages_detected' com 'ocr_applied: true') e auditoria orçamentária determinística integrada (Z10/Z12), construindo no topo do JSON o índice estrutural rápido 'toc_map', a Cartografia Estrutural em 3 camadas ('outline_headings', 'page_signals' e 'impugnation_zones' Z1..Z14), detectando páginas escaneadas como imagem ('scanned_pages_detected'), gerando o dossiê executivo de pontos quentes ('dossie_hotspots_<nome>.md' com contexto expandido ±12 linhas), calculando o 'structure_fingerprint', executando matching 1-para-N contra o cache global (core/registry/templates/) com rastreabilidade temporal (created_at, updated_at, age_days, cache_date_status, engine_version, slots_count e retrocompatibilidade v0.6.4) e reancoragem automática (Auto-Offset v0.6.0 gerando adapted_slots_manifest.json em drift 75%-99%), gerando a visão linear compacta de auditoria ('visao_auditoria_<nome>.md' com Bloco 1 Cartográfico + Radar Z1..Z14 e Bloco 2 paginado [PAG_XXX | LYYYY] ou [P...]) e gravando o JSON detalhado com retorno sintético executivo 'toc_summary' (< 1 KB, margem de segurança < 920 bytes).\n" +
        "- Quando usar (Pré-condição): Deve ser chamada após 'bootstrap_case' para inspecionar um documento individual .docx, .pdf, .xlsx, .csv ou .md específico, descobrir os índices exatos ou reaproveitar templates do cache global, OU após 'fill_docx_template' sobre o arquivo gerado em output/.\n" +
        "- Quando NÃO usar (Fora de Escopo): Se chamado fora de um caso DocGov ('cases/<slug>/'), os artefatos de saída serão isolados na pasta efêmera segura do sistema (%TEMP%/docgov_ephemeral_inspect/) sem poluir o diretório do usuário.\n" +
        "- Pós-condição & Próximo Passo: Grava em disco o mapa estrutural com toc_map/cartografia, o markdown 'visao_auditoria_<nome>.md' e o dossiê 'dossie_hotspots_<nome>.md'. Se template_match for EXACT ou MODIFIED, informe a data do cache ao usuário no Gate 1 e chame 'build_docx_template'; se NEW ou PDF, leia o dossiê de hotspots, a visão de auditoria ou elabore o slots_manifest.json.",
      inputSchema: {
        type: "object",
        required: ["filePath"],
        properties: {
          filePath: { type: "string", description: "Caminho do arquivo a ser inspecionado." },
          docxPath: { type: "string", description: "Alias retrocompatível para filePath." },
          outputPath: { type: "string", description: "Caminho onde o mapa JSON será gravado." },
          compact: { type: "boolean", description: "Se true, omite parágrafos e células vazias." },
          compareWithPath: { type: "string", description: "Caminho opcional de um documento base/anterior para Diff Estrutural." },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "build_docx_template",
      description:
        "Transforma um documento Word (.docx) bruto em um template parametrizado com tags {{...}} a partir de regras definidas em um slots_manifest.json, com auto-reparo e diagnóstico cirúrgico de JSON, preservando 100% da formatação visual (<w:pPr>, <w:rPr>, estilos, cabeçalhos e tabelas), Heading Guard em títulos de seção e auto-redirecionamento geométrico C1->C2 em checkboxes. Suporta coordenadas compactas do toc_map ('coord': 'T0.R1.C1' ou 'coord': 'P2', com ou sem colchetes), array raiz unificado 'slots: [...]', operador declarativo 'remove_table_rows' para poda bottom-up de linhas excedentes preservando <w:vMerge/>, aliases ('col_index', 'paragraph_index'), validação fail-fast estrita com padrão Exact Copy-Paste Error (Zero Silent No-Op) e 'saveToRegistry: true' para homologação no cache global cross-órgão (v0.6.2 / v1.3.8).\n" +
        "- Quando usar (Pré-condição): Deve ser chamada após 'inspect_doc' e após a elaboração/adaptação do arquivo 'slots_manifest.json'.\n" +
        "- Quando NÃO usar (Fora de Escopo): Proibido chamar fora de diretórios de caso 'cases/<slug>/'. Esta ferramenta é restrita ao fluxo de trabalho do ecossistema DocGov. Tarefas genéricas de manipulação de documentos ou templates externos devem utilizar ferramentas padrão do sistema operacional.\n" +
        "- Pós-condição & Próximo Passo: Gera o template .docx parametrizado com tags em outputPath (e opcionalmente registra no cache global). Próximo passo recomendado: elaborar o 'estado_caso.json' com os dados do processo e chamar 'fill_docx_template'.",
      inputSchema: {
        type: "object",
        required: ["sourcePath", "manifestPath", "outputPath"],
        properties: {
          sourcePath: { type: "string", description: "Caminho do Word (.docx) bruto original." },
          manifestPath: {
            type: "string",
            description:
              "Caminho do arquivo JSON de manifesto contendo as regras de slots (ex.: 'state/slots_manifest.json' ou 'state/adapted_slots_manifest.json'). Suporta notação compacta com { slots: [{ coord: 'T0.R1.C1', tag: '...' }, { coord: 'P2', tag: '...' }] } ou arrays canônicos como replace_paragraphs, replace_table_cells, loop_table_rows e replace_inline. Validação estrita: proíbe propriedades inventadas.",
          },
          outputPath: { type: "string", description: "Caminho do novo template .docx parametrizado." },
          saveToRegistry: { type: "boolean", description: "Se true, salva no cache global." },
          templateId: { type: "string", description: "Identificador único opcional no registro global." },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "fill_docx_template",
      description:
        "Injeta os dados de um estado_caso.json em um template Word (.docx) parametrizado com tags {{...}}, com auto-reparo de JSON, desaninhamento automático (unflatten) de chaves com notação de ponto (ex.: 'etp.necessidade'), resolvendo variáveis simples, loops FOR em tabelas, blocos condicionais IF, conversão nativa automática de tabelas Markdown ('| Col1 | Col2 |\\n| :--- | :--- |') para elementos OpenXML <w:tbl> reais (com <w:tblGrid>, bordas corporativas, cabeçalho sombreado e alinhamento por coluna, v1.3.7), auto-redirecionamento C1->C2 em células de checkbox, quebras de linha em múltiplos parágrafos, espaçamento vertical <w:spacing w:after=\"120\"/>, negrito seletivo (**texto**), reancoragem contextual de prefixos da seção pai (Parent Section Prefix Resolver v1.3.9) e injeção literal determinística de cláusulas multi-decimais com Hanging Indent e <w:tab/> sem nós <w:numPr> órfãos (eliminando o reset do Word para 1.1/1.1.1), com listas decimais simples no numbering nativo (word/numbering.xml, v0.7.0 / v1.3.9).\n" +
        "- Quando usar (Pré-condição): Deve ser chamada após 'build_docx_template' gerar o template e após a elaboração do 'estado_caso.json'.\n" +
        "- Quando NÃO usar (Fora de Escopo): Proibido chamar fora de diretórios de caso 'cases/<slug>/'. Esta ferramenta é restrita ao fluxo de trabalho do ecossistema DocGov. Tarefas genéricas de preenchimento ou conversão de arquivos devem utilizar ferramentas padrão do sistema operacional.\n" +
        "- Pós-condição & Próximo Passo: Gera a minuta final do documento Word em outputPath e executa automaticamente a inspeção estrutural gerando a visão linear de auditoria em state/visao_auditoria_<stem>.md. Próximo: acione o Auditor Externo lendo diretamente a visão linear (dispensado rodar inspect_doc novamente).",
      inputSchema: {
        type: "object",
        required: ["templatePath", "statePath", "outputPath"],
        properties: {
          templatePath: { type: "string", description: "Caminho do template Word (.docx)." },
          statePath: { type: "string", description: "Caminho do JSON contendo os dados do caso." },
          outputPath: { type: "string", description: "Caminho de saída da minuta final." },
          autoInspect: { type: "boolean", description: "Executa auto-inspeção gerando visao_auditoria. Padrão: true." },
          outputFormat: { type: "string", enum: ["docx", "pdf", "both"], description: "Formato de saída: docx, pdf ou both." },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "generate_audit_docx",
      description:
        "Gera um Relatório de Auditoria Técnico-Jurídica, Matriz de Gerenciamento de Riscos (Art. 18, X e Art. 22 Lei 14.133/2021), Checklist de Conformidade Normativa (TCU/AGU/MGI) ou Peça de Impugnação/Representação (Modo ATTACK com medida cautelar) em formato Word (.docx) e PDF em layout editorial vertical corrido (folha A4 retrato, zero tabelas <w:tbl>, 100% largura útil), com validação fail-fast estrita (padrão Exact Copy-Paste Error v0.6.2), sanitização automática de crases Markdown, coordenadas e códigos de enum, e transcrição integral de trechos probatórios (trechos_documento) em blocos de citação recuados.\n" +
        "- Quando usar (Pré-condição): Deve ser chamada após a auditoria do documento gerado e consolidação do arquivo 'relatorio_auditoria.json'.\n" +
        "- Quando NÃO usar (Fora de Escopo): Proibido chamar fora de diretórios de caso 'cases/<slug>/'. Esta ferramenta é restrita ao fluxo de trabalho do ecossistema DocGov. Tarefas genéricas de criação de relatórios ou arquivos arbitrários devem utilizar ferramentas padrão do sistema operacional.\n" +
        "- Pós-condição & Próximo Passo: Gera o documento .docx executivo do parecer de auditoria em outputPath. Conclui formalmente o ciclo de auditoria do processo.",
      inputSchema: {
        type: "object",
        required: ["auditJsonPath", "outputPath"],
        properties: {
          auditJsonPath: { type: "string", description: "Caminho do arquivo relatorio_auditoria.json ou peca_impugnacao.json." },
          outputPath: { type: "string", description: "Caminho onde o arquivo do parecer/peça será salvo." },
          outputFormat: { type: "string", enum: ["docx", "pdf", "both"], description: "Formato de saída: docx, pdf ou both." },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "generate_technical_note_docx",
      description:
        "Gera uma Nota Técnica Comparativa Padronizada de Evolução Documental ('Antes vs. Depois', Marco 6) ou Nota Técnica de Contrarrazões Jurídicas (Modo DEFENSE perante consultoria jurídica/controle) em Word (.docx) e PDF em layout editorial vertical corrido (folha A4 retrato, zero tabelas <w:tbl>, 100% largura útil), com destaque visual colorido por cards com bordas laterais (verde para inclusão, vermelho para supressão, azul para alteração), renderização granular de diff de tokens inline e fundamentação técnica/jurídica individualizada por cláusula alterada.\n" +
        "- Modos de operação híbridos:\n" +
        "  1) Direto via JSON: forneça 'noteJsonPath' e 'outputPath';\n" +
        "  2) Comparativo via arquivos: forneça 'oldPath' e 'newPath' (.docx, .pdf ou .json de estrutura) + 'outputPath' (e opcionalmente 'noteJsonPath' para enriquecer com justificativas elaboradas pelo agente).\n" +
        "- Quando usar (Pré-condição): Após alterações substantivas em minutas ou artefatos instrutórios (TR, ETP, Edital) para justificar a evolução aos órgãos de controle (TCU, AGU, Controle Interno).\n" +
        "- Quando NÃO usar (Fora de Escopo): Proibido chamar fora de diretórios de caso 'cases/<slug>/'. Esta ferramenta é restrita ao fluxo de trabalho do ecossistema DocGov. Tarefas genéricas de comparação de arquivos ou diff arbitrário fora de processos devem utilizar ferramentas padrão do sistema operacional.\n" +
        "- Pós-condição & Próximo Passo: Gera a Nota Técnica executiva em outputPath (.docx e opcionalmente .pdf). Conclui o ciclo de justificação e governança de alterações.",
      inputSchema: {
        type: "object",
        required: ["outputPath"],
        properties: {
          outputPath: { type: "string", description: "Caminho onde a nota técnica será gerada." },
          noteJsonPath: { type: "string", description: "Caminho do JSON com evolução ou contrarrazões." },
          oldPath: { type: "string", description: "Caminho do documento base para diff automático." },
          newPath: { type: "string", description: "Caminho do documento revisado para diff automático." },
          outputFormat: { type: "string", enum: ["docx", "pdf", "both"], description: "Formato: docx, pdf ou both." },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "fetch_pncp",
      description:
        "Busca e ingere de forma determinística os metadados e todos os arquivos públicos de uma contratação de referência no Portal Nacional de Contratações Públicas (PNCP), com isolamento estrito na subpasta 'inputs/pncp_<shortname>/', descompactação in-place transparente (.zip, .tar, .tar.gz) e catalogação leve para benchmarking técnico e pesquisa de mercado (IN SEGES/ME nº 65/2021).\n" +
        "- Quando usar (Pré-condição): Quando o usuário ou agente fornecer um identificador PNCP (número de controle em edital '00394460000141-1-000015/2026', URL do portal/API, tupla '00394460000141/2026/15' ou link de redirecionamento opaco do Google Grounding vertexaisearch.cloud.google.com/grounding-api-redirect/...) para obter insumos e modelos de referência externa sem misturá-los com as minutas sob auditoria do caso.\n" +
        "- Quando NÃO usar (Fora de Escopo): Proibido chamar fora de diretórios de caso 'cases/<slug>/'. Esta ferramenta é restrita à instrução e benchmarking de contratações do ecossistema DocGov. Downloads arbitrários de arquivos para outras finalidades devem utilizar ferramentas padrão do sistema operacional.\n" +
        "- Pós-condição & Próximo Passo: Arquivos disponíveis em 'inputs/pncp_<shortname>/', metadados salvos em 'state/pncp_<shortname>_meta.json' e catálogo de referência em 'state/indice_pncp_<shortname>.md'. Consulte o catálogo para orientar a leitura seletiva.",
      inputSchema: {
        type: "object",
        required: ["caseDir", "pncpIdOrUrl"],
        properties: {
          caseDir: { type: "string", description: "Diretório do caso de trabalho." },
          pncpIdOrUrl: { type: "string", description: "Identificador oficial do PNCP ou URL." },
          shortname: { type: "string", description: "Apelido curto opcional para a subpasta." },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "search_pncp",
      description:
        "Realiza busca textual multi-query no endpoint oficial /api/search/ do PNCP (Portal Nacional de Contratações Públicas) para localização de editais, termos de referência e contratações públicas de referência para benchmarking técnico e pesquisa de mercado (IN SEGES/ME nº 65/2021).\n" +
        "- Quando usar (Pré-condição): Quando o agente precisar descobrir contratações similares a partir de termos de busca, objetos ou nomes de órgãos, suportando consultas combinadas separadas por pipe '|' (ex.: 'fábrica de software | sustentação de sistemas') ou links de redirecionamento do Google Grounding (vertexaisearch.cloud.google.com/grounding-api-redirect/...). Executa as consultas em paralelo, desduplica resultados por CNPJ/ANO/SEQUENCIAL e acumula com buscas anteriores da sessão.\n" +
        "- Quando NÃO usar (Fora de Escopo): Se caseDir for omitido ou apontar para fora de 'cases/<slug>/', os resultados da busca serão acumulados no cache efêmero da sessão (%TEMP%/docgov_ephemeral_inspect/) sem persistir arquivos na pasta local do usuário.\n" +
        "- Pós-condição & Próximo Passo: Salva os candidatos completos em 'state/pncp_search_results.json' e a tabela consolidada com Objeto Integral em 'state/pncp_search_results.md'. Próximo passo: selecione o 'pncp_id' mais aderente e chame 'fetch_pncp' para baixar os arquivos para a subpasta isolada.",
      inputSchema: {
        type: "object",
        required: ["caseDir", "query"],
        properties: {
          caseDir: { type: "string", description: "Diretório do caso de trabalho." },
          query: { type: "string", description: "Termos de busca textual (aceita pipe '|')." },
          status: { type: "string", enum: ["todas", "recebendo_proposta", "encerradas"], description: "Filtro de situação." },
          uf: { type: "string", description: "Filtro de UF." },
          modalidade: { type: "string", description: "Filtro de modalidade." },
          limit: { type: "number", description: "Quantidade máxima de resultados." },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "search_juris",
      description:
        "Realiza a busca multi-query sob demanda em APIs oficiais de controle externo, tribunais superiores e órgãos consultivos federais (TCU, STJ, STF, TST, AGU e TCEs de 1ª Onda: PA, CE, DF), com expansor Statutory Bridge (Lei 13.303/2016 <-> Lei 14.133/2021) e ranking determinístico (0..100 pts) combinando 5 pesos táticos (aderência léxica, alinhamento com stance DEFENSE/ATTACK, regime estatais, colegiado e contemporaneidade), com Graceful Fallback para UFs não implementadas e geração de state/juris_search_results.json e .md com retorno sintético MCP < 900 bytes.\n" +
        "- Quando usar (Pré-condição): Ideal para Co-Autoria/Workbench Mode e pesquisa jurídica sob demanda para fundamentar pareceres, defesas ou impugnações.\n" +
        "- Pós-condição & Próximo Passo: Grava em disco os precedentes ordenados por relevance_score. Próximo passo recomendado: inspecionar o arquivo Markdown gerado e acionar 'fetch_juris' para autenticar e fatiar os leading cases selecionados.",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: {
            type: "string",
            description:
              "Expressão de pesquisa textual ou múltiplas queries separadas por '|' executadas em paralelo (ex.: 'lote único indivisibilidade | adjudicação global TI').",
          },
          caseDir: {
            type: "string",
            description:
              "Caminho do caso (ex.: 'cases/meu_caso'). Se omitido ou externo a cases/, grava na pasta efêmera segura (%TEMP%/docgov_ephemeral_inspect/).",
          },
          courts: {
            type: "array",
            items: { type: "string" },
            description:
              "Lista opcional de cortes a consultar (ex.: ['TCU', 'STJ', 'STF', 'TST', 'AGU', 'TCE-PA']). Se omitido e uf omitida, pesquisa a camada federal (TCU, STJ, STF).",
          },
          uf: {
            type: "string",
            description:
              "Sigla da UF de interesse (ex.: 'PA', 'CE', 'DF'). Se for informada UF não implementada (ex.: 'AM'), ativa Graceful Fallback sem falhar.",
          },
          stance: {
            type: "string",
            enum: ["DEFENSE", "ATTACK", "BOTH"],
            description:
              "Postura tática da pesquisa: 'DEFENSE' (prioriza improcedência e manutenção do certame), 'ATTACK' (prioriza anulação/cautelar) ou 'BOTH' (neutro).",
          },
          regime: {
            type: "string",
            enum: ["13303", "14133", "BOTH"],
            description:
              "Regime licitatório de foco: '13303' (Lei das Estatais), '14133' (Nova Lei de Licitações) ou 'BOTH'.",
          },
          colegiado: {
            type: "string",
            description:
              "Filtro opcional de colegiado (ex.: 'Plenário', '1ª Câmara', '2ª Câmara').",
          },
          limit: {
            type: "number",
            description:
              "Número máximo de precedentes retornados no ranking (padrão: 10).",
          },
        },
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    {
      name: "fetch_juris",
      description:
        "Trava anti-alucinação e fatiador anatômico de acórdãos em 6 Macro-Partes / 10 Sub-Camadas semânticas (Cabeçalho, Ementa, Relatório com divisão de fatos/defesa/AudTI, Voto com Ratio Decidendi, Dispositivo e Fecho com Quórum), verificando a autenticidade real do precedente na fonte oficial e gerando o Dossiê Fatiado de alta densidade por tópico em state/dossie_juris_<shortname>.md (Estágio 2) e o Inteiro Teor Estruturado em inputs/juris_<shortname>/inteiro_teor_anatomico.md (Estágio 3).\n" +
        "- Quando usar (Pré-condição): Após identificar um acórdão relevante em 'search_juris', para autenticá-lo e extrair os argumentos sem alucinação.\n" +
        "- Pós-condição & Próximo Passo: Precedente autenticado e fatiado em disco com payload sintético MCP < 900 bytes.",
      inputSchema: {
        type: "object",
        required: ["acordaoIdOrUrl"],
        properties: {
          acordaoIdOrUrl: {
            type: "string",
            description:
              "Número/identificador do acórdão (ex.: 'Acórdão 1234/2024-TCU-Plenário' ou '1234/2024') ou URL oficial do tribunal.",
          },
          caseDir: {
            type: "string",
            description:
              "Caminho do caso (ex.: 'cases/meu_caso'). Se omitido ou externo a cases/, grava na pasta efêmera segura (%TEMP%/docgov_ephemeral_inspect/).",
          },
          shortname: {
            type: "string",
            description:
              "Nome curto opcional para a subpasta de insumos e arquivo de dossiê (ex.: 'acordao_lote_unico').",
          },
          topicFilter: {
            type: "string",
            description:
              "Termos de tópico para filtragem cirúrgica do Dossiê do Estágio 2 (ex.: 'lote único | indivisibilidade').",
          },
          stance: {
            type: "string",
            enum: ["DEFENSE", "ATTACK", "BOTH"],
            description:
              "Postura tática opcional para enquadramento da ratio decidendi.",
          },
        },
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
  ];
}
