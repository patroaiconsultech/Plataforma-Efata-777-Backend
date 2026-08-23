# PATROAI Frontend Native Auth Hotfix - 2026-08-23

Este pacote substitui o fluxo OIDC/Zitadel remanescente pelo fluxo de autenticação nativa PatroAI no frontend.

## Como aplicar no GitHub

1. Abra o repositório frontend.
2. Envie os arquivos deste pacote mantendo exatamente os mesmos caminhos.
3. Remova do repositório os arquivos listados em `DELETE_FILES.txt`.
4. Confirme o deploy no Railway.

## Variáveis de produção do frontend

Manter:

```text
VITE_API_BASE_URL=https://plataforma-efata-777-backend-production.up.railway.app
VITE_STREAM_TIMEOUT_MS=300000
ORKIO_CSP_CONNECT_SRC=https://plataforma-efata-777-backend-production.up.railway.app
```

Remover qualquer valor antigo que contenha:

```text
orkio-efata777-gtaskz.us1.zitadel.cloud
VITE_OIDC_*
```

## Evidências locais

- `tsc --noEmit`: passou.
- `node --check server.mjs`: passou.
- `vite build`: passou fora do sandbox local em cópia temporária curta.
- Bundle gerado inspecionado sem ocorrências de `OIDC`, `auth/callback`, `VITE_OIDC`, `Authorization`, `Bearer` ou `provedor de identidade`.

## Resultado esperado em produção

- `/access` deve mostrar o portal com e-mail/senha, cadastro, primeira conta e recuperação de senha.
- `/env.js` não deve conter `VITE_OIDC_*`.
- A CSP não deve conter a origem Zitadel.
- `/assets/__missing_asset_probe_777__.js` deve retornar `404` com `Cache-Control: no-store`, não HTML com `200`.
