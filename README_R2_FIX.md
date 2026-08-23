# EFATA777 Backend Catalog JSON R2 Fix

Este pacote corrige a falha de build no Railway:

`RuntimeError: AGENT_CATALOG_SHA256_MISMATCH`

## Causa confirmada

No GitHub, o arquivo `src/orkio_v2/agents/catalog.py` ja espera:

`ba0be8b745e0ad049bf4f99203599273694ce3c911709e6a06366b0c3efae084`

Mas o arquivo publicado `src/orkio_v2/agents/catalog_r034.json` ainda estava com:

`759d070ebbec9d730da99c5f69775c0382c5de2d79835ba1baa92ae64367764a`

## Como aplicar manualmente no GitHub

Substitua estes arquivos no repositorio backend, mantendo exatamente os mesmos caminhos:

- `src/orkio_v2/agents/catalog_r034.json`
- `src/orkio_v2/agents/catalog.py`
- `src/orkio_v2/routes.py`
- `SHA256SUMS`
- `RELEASE_MANIFEST.json`

## Conferencia obrigatoria antes do Railway redeploy

Depois do upload no GitHub, abra:

`src/orkio_v2/agents/catalog_r034.json`

No GitHub, o arquivo deve ter cerca de 261 KB. Se ele continuar pequeno ou se nao tiver sido substituido, o Railway continuara quebrando.

Depois, confira que:

`src/orkio_v2/agents/catalog.py`

contem:

`CATALOG_JSON_SHA256 = "ba0be8b745e0ad049bf4f99203599273694ce3c911709e6a06366b0c3efae084"`

## Resultado esperado

O step 7/9 do Dockerfile deve passar pelo comando:

`python -c "import faster_whisper; import orkio_v2.main; print('STT_DEPENDENCY_PRESENT')"`

