# EFATA777 Backend Postdeploy Hotfix — 2026-08-23

## Motivo
O repositório GitHub pós-upload (`1ffe72359d0520fffad0a5a6b7f16cf14154a1d3`) ainda contém dois arquivos com conteúdo antigo:

- `src/orkio_v2/agents/catalog.py`
- `src/orkio_v2/routes.py`

Isso mantém o backend quebrado no import local com:

`RuntimeError: AGENT_CATALOG_SHA256_MISMATCH`

## Arquivos incluídos
Subir estes arquivos por cima no repositório backend:

- `src/orkio_v2/agents/catalog.py`
- `src/orkio_v2/routes.py`
- `RELEASE_MANIFEST.json`
- `SHA256SUMS`

## Correções
1. `catalog.py`
   - `CATALOG_JSON_SHA256` atualizado para o hash real do `catalog_r034.json`:
   - `ba0be8b745e0ad049bf4f99203599273694ce3c911709e6a06366b0c3efae084`

2. `routes.py`
   - troca da validação de storage path baseada em string por `target.relative_to(root)`.

## Evidência local pós-hotfix
Executado no clone pós-upload com o hotfix aplicado:

- Import smoke: `IMPORT_OK`
- Pytest completo: `420 passed, 2 skipped, 3 warnings`

## Observação
O Railway publicado ainda responde `/health` e `/ready`, mas o GitHub atual sem este hotfix não é reproduzível localmente. Depois do upload deste hotfix, aguardar novo deploy e reexecutar smoke.
