# Guia de upload manual — Plataforma Efatá 777

Este documento acompanha dois pacotes de arquivos prontos para upload direto nos repositórios. Cada pacote preserva a estrutura de pastas exata do repositório de destino, de modo que basta descompactar e enviar mantendo os caminhos.

## Advertência crítica sobre o método de upload

Antes de qualquer coisa, um ponto que determina o sucesso da operação. A causa raiz de toda a falha original do frontend foi exatamente este mecanismo: **a interface web do GitHub omite arquivos cujo nome começa com ponto**. Foi assim que `.npmrc`, `.nvmrc`, `.gitignore`, `.env.example` e o diretório `.github/` desapareceram do repositório, provocando o `DOCKER_COPY_FAILURE` na linha 3 do Dockerfile.

O pacote do frontend contém **sete arquivos ocultos entre os nove**. Se o upload for feito arrastando arquivos para a interface web do GitHub, é bastante provável que a falha se repita de forma idêntica.

Três formas de evitar isso, em ordem de segurança:

A via mais segura é usar **GitHub Desktop** ou **git por linha de comando** em uma máquina onde você tenha permissão de escrita. Esses clientes tratam arquivos ocultos normalmente e o `.gitignore` incluído no pacote garante que artefatos indesejados não sejam versionados.

Se precisar usar a interface web, **crie cada arquivo oculto individualmente** pela função "Create new file", digitando o nome completo com o ponto e colando o conteúdo. A interface aceita a criação manual de arquivos ocultos; ela apenas não os inclui em upload por arraste. Para o diretório `.github/workflows/`, digite o caminho completo `.github/workflows/01-verify-build.yml` no campo de nome — o GitHub cria as pastas automaticamente.

Para o `package-lock.json`, que tem cerca de 60 KB e não é oculto, o upload por arraste funciona normalmente.

## Pacote 1 — Backend

**Repositório de destino:** `patroaiconsultech/Plataforma-Efata-777-Backend`

Três arquivos, sendo dois modificados e um novo. Nenhum é oculto, portanto o upload web funciona sem ressalvas aqui.

| Caminho no repositório | Situação | SHA-256 |
|---|---|---|
| `src/orkio_v2/database.py` | modificado | `834b1d77f98768f6…` |
| `migrations/env.py` | modificado | `4febd935e98ef6d6…` |
| `tests/test_database_url_normalization.py` | **novo** | `9cf6643b2933ed99…` |

### O que cada arquivo resolve

O `database.py` corrige o crash loop em produção. O backend morria com `ModuleNotFoundError: No module named 'psycopg2'` porque a `DATABASE_URL` do Railway usa o esquema `postgresql://`, que o SQLAlchemy 2.0 resolve para o dialeto `psycopg2` — ausente no projeto, que declara `psycopg[binary]>=3.2`. A função `normalize_database_url()` reescreve o esquema para `postgresql+psycopg://`, alinhando a URL ao driver instalado. SQLite e esquemas com driver explícito passam intactos.

O `migrations/env.py` corrige um bloqueador que ainda não havia se manifestado, porque nenhuma migration foi executada. O `alembic.ini` declara `sqlalchemy.url = sqlite:///./orkio_v2.db`, e o `env.py` lia essa configuração. Consequência: `alembic upgrade head` criaria as tabelas em um arquivo SQLite local, jamais no PostgreSQL do Railway — silenciosamente, sem erro. Agora a URL é resolvida por `get_settings().database_url` e normalizada pela mesma função do runtime, garantindo alvo único.

O arquivo de teste cobre a normalização com sete casos, incluindo a verificação de que `engine.url.drivername` resulta em `postgresql+psycopg` sem abrir conexão real.

### Validação já realizada

Suíte completa do backend: **14 aprovados, 0 falhas**. Nenhuma migration existente foi alterada. O `pyproject.toml` não foi tocado e `psycopg2-binary` não foi adicionado, evitando dois drivers concorrentes.

## Pacote 2 — Frontend

**Repositório de destino:** `patroaiconsultech/Plataforma-Efata-777-Frontend`

Nove arquivos, todos novos. Sete são ocultos — atenção redobrada ao método de upload.

| Caminho no repositório | Oculto | SHA-256 conferido |
|---|---|---|
| `.env.example` | sim | OK |
| `.github/CODEOWNERS` | sim | OK |
| `.github/workflows/00-materialize-lockfile.yml` | sim | OK |
| `.github/workflows/01-verify-build.yml` | sim | OK |
| `.gitignore` | sim | OK |
| `.npmrc` | sim | OK |
| `.nvmrc` | sim | OK |
| `LOCKFILE_SHA256SUMS.txt` | não | novo |
| `package-lock.json` | não | novo |

### Prova de integridade

Os sete arquivos ocultos foram validados **byte a byte** contra o `SHA256SUMS.txt` já versionado no próprio repositório. Todos conferem. Isso significa que são os arquivos originais da Alpha 2.2, não reconstruções por inferência. Com o upload correto, a integridade do repositório passa de 57/64 para **64/64**.

O `package-lock.json` e o `LOCKFILE_SHA256SUMS.txt` são novos porque nunca existiram no repositório. Foram gerados pelo script `scripts/materialize-lockfile.sh` do próprio projeto, sob Node v20.20.2 e npm 10.8.2 — as versões exatas que o script exige e verifica. O lockfile tem `lockfileVersion=3`, 118 pacotes, nenhum `resolved` fora do registry oficial e nenhuma entrada sem `integrity`.

### Validação já realizada

Com esses nove arquivos no lugar: `npm ci` funciona, `check:server` e `check:sw` passam, a suíte de testes resulta em **40 aprovados, 0 falhas**, o build Vite conclui em 43 módulos, `verify:dist` aprova os nove arquivos obrigatórios, o servidor responde 200 em `/` e `/app`, e não há source maps no dist.

## Ordem recomendada

Recomendo o **frontend primeiro**, por dois motivos. Primeiro, é a correção cuja validação está completa e cujo resultado é imediatamente verificável: o build passa a funcionar e o domínio deixa de retornar 404. Segundo, os dois workflows incluídos em `.github/workflows/` estabelecem verificação automática de build — a partir daí, o repositório passa a impedir por conta própria que um commit sem lockfile chegue a produção. É a correção que também previne a recorrência.

O backend depois, porque sua validação final depende de deploy real. Após o upload, o Railway fará redeploy automático e será necessário observar o log. O sinal de sucesso é a ausência de `ModuleNotFoundError` e o `GET /api/v2/health` retornando 200.

## Depois do upload do backend

Uma sequência de verificação, na ordem, antes de considerar o backend restaurado:

Primeiro, confirme no Deploy Log do Railway que `ModuleNotFoundError: No module named 'psycopg2'` **desapareceu**. Segundo, observe o serviço por cinco minutos e confirme que não há reinício cíclico. Terceiro, chame `GET /api/v2/health` e espere **200**.

Somente após esses três sinais é que faz sentido tratar as migrations. E aqui vale a cautela que você mesmo apontou: `alembic upgrade head` só deve ser executado depois de comprovado que o alvo é o PostgreSQL. O Patch 2 corrige o direcionamento, mas a comprovação exige rodar `alembic current` e `alembic heads` no ambiente real e verificar que a conexão vai para o banco do Railway, não para um arquivo local.

## Pendências que permanecem

Duas coisas continuam abertas e independem destes patches.

A **rotação das credenciais expostas** segue pendente. A chave da OpenAI, a senha do PostgreSQL e os segredos JWT do repositório anterior ficaram visíveis no Raw Editor do Railway e devem ser considerados comprometidos. A chave da OpenAI é a mais urgente por ter custo financeiro direto.

A **autenticação da plataforma permanece inoperante por desenho**. O `PLATFORM_AUTH_MODE` está em `external_required` e o frontend não possui fluxo de login — nenhum arquivo em `src/` grava o token que o `api.ts` tenta ler. Restaurar o backend e o build do frontend torna a plataforma **acessível e saudável**, mas ainda não **autenticável**. Esse é o próximo bloqueador da sequência, e exige implementar o fluxo OIDC no frontend antes de qualquer provisionamento de provedor.
