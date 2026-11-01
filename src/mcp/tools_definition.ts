// ============================================================================
// Definições de Ferramentas e Prompts MCP (docgov-engine v1.4.0)
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
        "Realiza a engenharia reversa estrutural completa de documentos individuais Word (.docx), PDF (.pdf com agrupamento Y e colunas), planilhas Excel (.xlsx com indexação exata por r='A1'), CSV (.csv) ou textos/markdown (.md/.txt), construindo o índice estrutural 'toc_map', a Cartografia Estrutural em 3 camadas, Radar das 14 Zonas de Impugnação (Z1..Z14) e dossiês cirúrgicos.\n" +
        "- Pós-condição: Salva estrutura_<stem>.json, visao_auditoria_<stem>.md e dossie_hotspots_<stem>.md.",
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
        "Transforma um documento Word (.docx) bruto em um template parametrizado com tags {{...}} a partir de regras definidas em um slots_manifest.json, preservando formatação visual, Heading Guard em títulos e auto-redirecionamento C1->C2 em checkboxes.",
      inputSchema: {
        type: "object",
        required: ["sourcePath", "manifestPath", "outputPath"],
        properties: {
          sourcePath: { type: "string", description: "Caminho do Word (.docx) bruto original." },
          manifestPath: { type: "string", description: "Caminho do JSON de manifesto de slots." },
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
        "Injeta os dados de um estado_caso.json em um template Word (.docx) parametrizado com tags {{...}}, com conversão nativa de tabelas Markdown para elementos <w:tbl>, espaçamento vertical, e auto-inspeção gerando visao_auditoria.",
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
        "Gera um Relatório de Auditoria Técnico-Jurídica, Matriz de Riscos, Checklist de Conformidade ou Peça de Impugnação/Representação (Modo ATTACK com medida cautelar) em layout editorial A4 vertical (zero tabelas <w:tbl>).",
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
        "Gera uma Nota Técnica Comparativa Padronizada de Evolução Documental ('Antes vs. Depois') ou Nota Técnica de Contrarrazões Jurídicas (Modo DEFENSE perante consultoria jurídica/controle) em layout editorial A4 vertical.",
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
        "Busca e ingere de forma determinística os metadados e todos os arquivos públicos de uma contratação de referência no Portal Nacional de Contratações Públicas (PNCP), com isolamento estrito na subpasta 'inputs/pncp_<shortname>/'.",
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
        "Realiza busca textual multi-query no endpoint oficial /api/search/ do PNCP para localização de editais e contratações públicas de referência para benchmarking técnico e pesquisa de mercado.",
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
        "Realiza a busca multi-query sob demanda em APIs oficiais de controle externo e tribunais superiores (TCU, STJ, STF e TCEs de 1ª Onda: PA, CE, DF), com expansor Statutory Bridge (Lei 13.303/2016 <-> Lei 14.133/2021) e ranking determinístico (0..100 pts) combinando 5 pesos táticos (aderência léxica, alinhamento com stance DEFENSE/ATTACK, regime estatais, colegiado e contemporaneidade), com Graceful Fallback para UFs não implementadas e geração de state/juris_search_results.json e .md com retorno sintético MCP < 900 bytes.\n" +
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
              "Lista opcional de cortes a consultar (ex.: ['TCU', 'STJ', 'STF', 'TCE-PA']). Se omitido e uf omitida, pesquisa a camada federal (TCU, STJ, STF).",
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
