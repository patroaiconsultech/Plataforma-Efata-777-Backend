# Patch incremental — backend: documentos e Markdown

Este ZIP contém somente os arquivos alterados neste ciclo. Faça o upload manual dos caminhos mantendo a estrutura relativa à raiz do repositório backend. Não faça upload de `dist`, caches, `.env`, credenciais, locks ou do release completo.

## Ordem de aplicação

1. Confirme que o repositório correto é o backend e compare a árvore atual com os caminhos deste pacote. O candidato local foi baseado em `d2ffe9a589cd6374beaffe0455fb084138ed6dd3`; a referência remota observada no empacotamento foi `e2b31638eb53b0999d54943d45e78cc1433c92d5`. Se a `main` atual divergir, preserve o conteúdo mais recente e aplique somente os trechos equivalentes, resolvendo conflitos antes do commit.
2. Faça upload/sobrescrita dos três arquivos de código/teste nas pastas correspondentes e então execute a suíte backend/CI antes de promover.
3. No Railway, verifique as variáveis de produção sem registrar valores em issue, log, ZIP ou frontend. Para documentos ativos, mantenha `PLATFORM_ARTIFACTS_ENABLED=true`, `PLATFORM_ARTIFACT_STORAGE_BACKEND=s3`, bucket/região/endpoint e credenciais S3 válidos, prefixo sem `..`, `PLATFORM_ARTIFACT_STORAGE_SSE` como `AES256` ou `aws:kms` e `PLATFORM_ARTIFACT_STORAGE_KMS_KEY_ID` quando usar KMS. O endpoint customizado deve ser HTTPS.
4. Mantenha `PLATFORM_ENVIRONMENT=production`, `PLATFORM_RELEASE_SHA` igual ao commit efetivamente implantado, PostgreSQL com TLS e a autoridade OIDC/ZITADEL já aprovada. Não habilite storage local como solução de produção.
5. Após o deploy, observe os logs. Se o armazenamento continuar indisponível, o backend deve preservar a mensagem textual e encerrar o SSE como `status=completed`, incluindo `artifact_error=ARTIFACT_STORAGE_ERROR` ou outro código honesto; isso sinaliza configuração S3 pendente, não uma correção automática de credenciais. O log operacional esperado para esse caminho é `ARTIFACT_OPTIONAL_OUTPUT_FAILED`.

## Critérios de aceite

O POST de upload deve retornar sucesso quando o storage estiver configurado; a leitura de contexto deve ficar `ready` ou `pending`, nunca transformar um upload já confirmado em falso erro genérico; uma solicitação Markdown deve terminar o SSE com `completed`; com S3 saudável, deve existir payload/cartão de artefato e download válido. Teste também PDF, DOCX, PPTX, XLSX e JSON conforme o contrato existente.

Nunca inclua valores reais de S3, OIDC, banco, LLM, SMTP ou tokens nos arquivos deste pacote.
