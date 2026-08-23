# PatroAI Native Auth + Resend

Pacote para substituir o fluxo OIDC/Zitadel por autenticação própria PatroAI com sessão em cookie HttpOnly, senha hasheada no backend, recuperação de senha por Resend e UX nativa de login/cadastro/reset.

## Variáveis obrigatórias no backend

- `PLATFORM_AUTH_MODE=native_session`
- `PLATFORM_NATIVE_AUTH_PEPPER=<segredo aleatorio com 32+ caracteres>`
- `PLATFORM_NATIVE_SESSION_SECRET=<segredo aleatorio com 32+ caracteres>`
- `PLATFORM_NATIVE_BOOTSTRAP_SECRET=<segredo temporario com 32+ caracteres>`
- `PLATFORM_NATIVE_SESSION_COOKIE_SECURE=true`
- `PLATFORM_NATIVE_PASSWORD_RESET_BASE_URL=https://www.patroai.com`
- `RESEND_API_KEY=<chave da conta Resend>`
- `RESEND_FROM=PatroAI <no-reply@patroai.com>`

Em staging/producao, o backend recusa iniciar sem URL HTTPS de reset, cookie seguro e Resend configurado.

## Fluxos entregues

- Login nativo em `/access`.
- Primeira conta via `PLATFORM_NATIVE_BOOTSTRAP_SECRET`.
- Cadastro com codigo de acesso existente.
- Esqueci minha senha com envio de e-mail via Resend.
- Reset com token, senha e confirmacao de senha.
- Botao mostrar/ocultar senha no login, cadastro, bootstrap e reset.
- Sessao em cookie HttpOnly, sem token sensivel em `sessionStorage`.

## Validacao local executada

- Backend: `python -m py_compile ...` passou.
- Backend: `pytest tests/test_native_auth.py -q` passou, 5/5.
- Backend: `pytest tests/test_predeploy_hardening.py tests/test_functional_foundation.py -q` passou, 34/34.
- Frontend: `node --check server.mjs` passou.
- Frontend: `tsc --noEmit` passou.

Observacao: `vite build` neste ambiente falhou por permissao do `esbuild` ao resolver o caminho longo no OneDrive (`Access is denied`). A falha e ambiental. Os testes Node antigos ainda contem assercoes OIDC/sessionStorage e devem ser atualizados/removidos na trilha de migração para auth nativo.
