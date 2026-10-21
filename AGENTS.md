# Estatuto de Governança do Motor MCP docgov-engine

Este documento estabelece as 7 Leis Invioláveis de Engenharia do motor standalone `docgov-engine`. Qualquer agente de IA ou desenvolvedor deve segui-las estritamente em todas as sessões e contribuições.

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
