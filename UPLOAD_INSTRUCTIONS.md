# Patch incremental — frontend: documentos e Aurora musical desktop

Este ZIP contém somente os arquivos alterados neste ciclo. Faça o upload manual dos caminhos mantendo a estrutura relativa à raiz do repositório frontend. Não faça upload de `dist`, caches, `.env`, credenciais, package locks ou do release completo.

## Ordem de aplicação

1. Confirme que o repositório correto é o frontend e compare a árvore atual com os caminhos deste pacote. O candidato local foi baseado em `04d616e4db8f6fb845b0ec957c086c145a6eb90c`; a referência remota observada no empacotamento foi `57a93f5291e5a130c14fa282d067622f64f5f360`. Se a `main` atual divergir, preserve o conteúdo mais recente e aplique somente os trechos equivalentes, resolvendo conflitos antes do commit.
2. Faça upload/sobrescrita dos cinco arquivos nas pastas correspondentes, execute TypeScript, testes, build e verificações de servidor/service worker/dist antes do deploy.
3. Depois do deploy, faça hard reload e, se necessário, limpe o cache do site/service worker. Revalide o fluxo de upload `.md`, estado de contexto `ready`/`pending`, geração Markdown e download quando o backend retornar artefato.
4. Na landing desktop, clique explicitamente para iniciar a experiência sonora. O movimento usa a energia suavizada do `AnalyserNode` e atualiza `--desktop-neural-energy`, `--desktop-neural-pulse` e `--music-motion-duration`; a emissão deve partir do núcleo para fora em órbita radial, com variação perceptível de pulso, alcance, brilho e duração conforme a música. O fallback sem áudio e mobile permanece preservado.

## Critérios de aceite

O upload confirmado não deve virar falso erro se a chamada opcional de provenance/contexto falhar; a interface deve comunicar armazenamento confirmado e leitura pendente. Na landing desktop, o usuário deve perceber partículas azuis/ciano emitindo radialmente do núcleo e respondendo à trilha após a ação de iniciar áudio. A sincronização musical real exige interação de navegador com áudio permitido; build e testes estáticos não substituem essa verificação.

As únicas variáveis públicas do frontend continuam sendo as já aprovadas, como `VITE_API_BASE_URL`, endpoints/client ID públicos OIDC, `VITE_STREAM_TIMEOUT_MS` e `ORKIO_CSP_CONNECT_SRC`. Nunca coloque secrets no bundle ou no ZIP.
