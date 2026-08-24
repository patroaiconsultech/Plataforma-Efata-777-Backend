// Transitional Wave 1 bridge.
//
// The markup below is immutable, source-controlled PatroAI landing content
// migrated from the audited standalone index.html at baseline 342f5c4.
// It contains no user-provided HTML. Interactions are mounted separately in
// premiumInteractions.ts so the React router remains the canonical runtime.

export const premiumMarkup = String.raw`

<div class="immersive-gate" id="immersiveGate" role="dialog" aria-modal="true" aria-labelledby="immersiveTitle" aria-describedby="immersiveCopy">
  <div class="immersive-gate__backdrop" aria-hidden="true"></div>
  <div class="immersive-gate__network" aria-hidden="true">
    <svg viewBox="0 0 1000 700" preserveAspectRatio="none" role="presentation">
      <defs>
        <linearGradient id="immersiveGateNetworkGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#37C5FF" stop-opacity=".10"></stop>
          <stop offset=".28" stop-color="#7D6BFF" stop-opacity=".46"></stop>
          <stop offset=".52" stop-color="#F6C453" stop-opacity=".78"></stop>
          <stop offset=".76" stop-color="#28F0B5" stop-opacity=".44"></stop>
          <stop offset="1" stop-color="#37C5FF" stop-opacity=".10"></stop>
        </linearGradient>
      </defs>
      <g class="immersive-gate__network-lines">
        <path style="--i:0" d="M18 104 L144 194 L280 112 L418 236 L556 142 L704 248 L852 136 L990 220"></path>
        <path style="--i:1" d="M-20 348 L128 288 L264 382 L404 300 L542 408 L680 330 L824 404 L1020 312"></path>
        <path style="--i:2" d="M44 588 L176 486 L314 548 L450 454 L594 552 L742 460 L894 536 L1028 456"></path>
        <path style="--i:3" d="M144 194 L128 288 L176 486"></path>
        <path style="--i:4" d="M280 112 L264 382 L314 548"></path>
        <path style="--i:5" d="M418 236 L404 300 L450 454"></path>
        <path style="--i:6" d="M556 142 L542 408 L594 552"></path>
        <path style="--i:7" d="M704 248 L680 330 L742 460"></path>
        <path style="--i:8" d="M852 136 L824 404 L894 536"></path>
      </g>
      <g class="immersive-gate__energy-flow" aria-hidden="true">
        <path style="--i:0" d="M18 104 L144 194 L280 112 L418 236 L556 142 L704 248 L852 136 L990 220"></path>
        <path style="--i:1" d="M-20 348 L128 288 L264 382 L404 300 L542 408 L680 330 L824 404 L1020 312"></path>
        <path style="--i:2" d="M44 588 L176 486 L314 548 L450 454 L594 552 L742 460 L894 536 L1028 456"></path>
        <path style="--i:3" d="M144 194 L128 288 L176 486"></path>
        <path style="--i:4" d="M280 112 L264 382 L314 548"></path>
        <path style="--i:5" d="M418 236 L404 300 L450 454"></path>
        <path style="--i:6" d="M556 142 L542 408 L594 552"></path>
        <path style="--i:7" d="M704 248 L680 330 L742 460"></path>
        <path style="--i:8" d="M852 136 L824 404 L894 536"></path>
      </g>
      <g class="immersive-gate__network-nodes">
        <circle style="--i:0" cx="18" cy="104" r="4"></circle><circle style="--i:1" cx="144" cy="194" r="5"></circle><circle style="--i:2" cx="280" cy="112" r="4"></circle><circle style="--i:3" cx="418" cy="236" r="5"></circle><circle style="--i:4" cx="556" cy="142" r="4"></circle><circle style="--i:5" cx="704" cy="248" r="5"></circle><circle style="--i:6" cx="852" cy="136" r="4"></circle><circle style="--i:7" cx="990" cy="220" r="4"></circle>
        <circle style="--i:8" cx="128" cy="288" r="4"></circle><circle style="--i:9" cx="264" cy="382" r="5"></circle><circle style="--i:10" cx="404" cy="300" r="4"></circle><circle style="--i:11" cx="542" cy="408" r="5"></circle><circle style="--i:12" cx="680" cy="330" r="4"></circle><circle style="--i:13" cx="824" cy="404" r="5"></circle><circle style="--i:14" cx="176" cy="486" r="4"></circle><circle style="--i:15" cx="314" cy="548" r="5"></circle><circle style="--i:16" cx="450" cy="454" r="4"></circle><circle style="--i:17" cx="594" cy="552" r="5"></circle><circle style="--i:18" cx="742" cy="460" r="4"></circle><circle style="--i:19" cx="894" cy="536" r="5"></circle>
      </g>
    </svg>
    <div class="aurora-particle-field aurora-particle-field--gate" aria-hidden="true">
      <span style="--i:0"></span><span style="--i:1"></span><span style="--i:2"></span><span style="--i:3"></span>
      <span style="--i:4"></span><span style="--i:5"></span><span style="--i:6"></span><span style="--i:7"></span>
      <span style="--i:8"></span><span style="--i:9"></span><span style="--i:10"></span><span style="--i:11"></span>
    </div>
  </div>
  <div class="immersive-gate__panel">
    <div class="immersive-gate__brand" aria-hidden="true">
      <span class="immersive-gate__halo"></span>
      <img src="/assets/logo-patroai-oficial.png" alt="" />
    </div>
    <p class="immersive-gate__eyebrow" data-i18n="immersive.eyebrow">PATROAI · EXPERIÊNCIA IMERSIVA</p>
    <h1 id="immersiveTitle" data-i18n="immersive.title">Este é um ambiente imersivo.</h1>
    <p id="immersiveCopy" data-i18n="immersive.copy">Escolha entrar com som para viver a experiência completa ou continuar sem áudio.</p>

    <div class="immersive-gate__actions">
      <button
        class="immersive-gate__sound"
        id="immersiveSoundEntry"
        type="button"
        data-immersive-sound="true"
      >
        <span class="immersive-gate__headphones" aria-hidden="true">
          <svg viewBox="0 0 64 64" role="presentation">
            <path d="M12 34v-5C12 18 21 9 32 9s20 9 20 20v5" />
            <path d="M12 33h5c3 0 5 2 5 5v10c0 3-2 5-5 5h-2c-3 0-5-2-5-5V37c0-2 1-3 2-4Z" />
            <path d="M52 33h-5c-3 0-5 2-5 5v10c0 3 2 5 5 5h2c3 0 5-2 5-5V37c0-2-1-3-2-4Z" />
            <path d="M42 52c-3 2-6 3-10 3" />
          </svg>
        </span>
        <span>
          <strong data-i18n="immersive.sound.cta">Entrar com experiência sonora</strong>
          <small data-i18n="immersive.sound.copy">Ativar a trilha e entrar no núcleo imersivo</small>
        </span>
      </button>

      <button class="immersive-gate__silent" type="button" data-immersive-silent="true">
        <span data-i18n="immersive.silent">Explorar sem som</span>
      </button>
      <a class="immersive-gate__direct" href="#top" data-immersive-direct="true">
        <span data-i18n="immersive.direct">Ir direto para a apresentação</span>
      </a>
    </div>

    <p class="immersive-gate__headphone-note" data-i18n="immersive.headphones">Recomendamos o uso de fones de ouvido para uma experiência mais imersiva.</p>

    <div class="immersive-gate__footer">
      <button class="immersive-gate__copyright-link" type="button" aria-expanded="false" aria-controls="immersiveCopyright" data-copyright-toggle="true">
        Aviso autoral
      </button>
      <span aria-hidden="true">•</span>
      <span>Aproveite a imersão.</span>
    </div>

    <div class="immersive-gate__copyright" id="immersiveCopyright" hidden>
      <p>
        As obras sonoras acessadas nesta experiência permanecem vinculadas ao autor e à plataforma de origem.
        Direitos autorais reservados ao autor das obras, conforme informado no destino acessado.
      </p>
      <div class="immersive-gate__works" aria-label="Experiência sonora PatroAI">
        <span>Obra imersiva</span>
        <a href="https://suno.com/@daninavioficial" target="_blank" rel="noopener noreferrer">
          Conheça mais obras deste artista
        </a>
      </div>
      <p class="immersive-gate__sequence-note">
        A reprodução acontece na própria landing após sua escolha explícita.
      </p>
    </div>
  </div>
</div>

<section
  class="neural-lobby"
  id="neuralLobby"
  aria-label="Núcleo de navegação PatroAI"
  aria-hidden="true"
>
  <div class="neural-lobby__canvas-stage" aria-hidden="true">
    <canvas id="lobbyBrainCanvas"></canvas>
  </div>

  <div class="neural-lobby__network" aria-hidden="true">
    <svg viewBox="0 0 1000 700" preserveAspectRatio="none" role="presentation">
      <defs>
        <linearGradient id="neuralLobbyNetworkGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#37C5FF" stop-opacity=".18"></stop>
          <stop offset=".28" stop-color="#7D6BFF" stop-opacity=".62"></stop>
          <stop offset=".52" stop-color="#F6C453" stop-opacity=".88"></stop>
          <stop offset=".76" stop-color="#28F0B5" stop-opacity=".58"></stop>
          <stop offset="1" stop-color="#37C5FF" stop-opacity=".16"></stop>
        </linearGradient>
        <filter id="efataPlasmaWarp" x="-20%" y="-25%" width="140%" height="150%" color-interpolation-filters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency=".006 .018" numOctaves="2" seed="17" result="noise"></feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="13" xChannelSelector="R" yChannelSelector="B"></feDisplacementMap>
          <feGaussianBlur stdDeviation="1.4"></feGaussianBlur>
        </filter>
      </defs>
      <g class="neural-lobby__network-lines neural-lobby__network-lines--curved" filter="url(#efataPlasmaWarp)">
        <path class="neural-lobby__stream neural-lobby__stream--blue neural-lobby__stream--rail" style="--i:0" d="M-40 160 C120 90 245 95 365 190 C430 242 458 264 500 286"></path>
        <path class="neural-lobby__stream neural-lobby__stream--violet neural-lobby__stream--rail" style="--i:1" d="M1040 150 C875 84 748 98 638 190 C575 242 545 263 500 286"></path>
        <path class="neural-lobby__stream neural-lobby__stream--green neural-lobby__stream--rail" style="--i:2" d="M-55 520 C125 555 248 505 357 408 C428 345 460 319 500 286"></path>
        <path class="neural-lobby__stream neural-lobby__stream--gold neural-lobby__stream--rail" style="--i:3" d="M1055 510 C875 550 744 502 640 406 C573 344 541 319 500 286"></path>
        <path class="neural-lobby__stream neural-lobby__stream--blue neural-lobby__stream--rail neural-lobby__stream--secondary" style="--i:4" d="M-35 305 C132 248 280 260 392 305 C442 325 470 315 500 286"></path>
        <path class="neural-lobby__stream neural-lobby__stream--violet neural-lobby__stream--rail neural-lobby__stream--secondary" style="--i:5" d="M1035 302 C866 244 725 255 612 305 C560 328 531 316 500 286"></path>
        <path class="neural-lobby__stream neural-lobby__stream--green neural-lobby__stream--rail neural-lobby__stream--secondary" style="--i:6" d="M185 700 C205 590 285 498 380 408 C438 353 469 321 500 286"></path>
        <path class="neural-lobby__stream neural-lobby__stream--gold neural-lobby__stream--rail neural-lobby__stream--secondary" style="--i:7" d="M815 700 C795 590 716 500 620 410 C563 356 531 322 500 286"></path>
      </g>
      <g class="neural-lobby__energy-flow neural-lobby__energy-flow--curved" aria-hidden="true">
        <path class="neural-lobby__stream neural-lobby__stream--blue neural-lobby__stream--pulse" style="--i:0" d="M-40 160 C120 90 245 95 365 190 C430 242 458 264 500 286"></path>
        <path class="neural-lobby__stream neural-lobby__stream--violet neural-lobby__stream--pulse" style="--i:1" d="M1040 150 C875 84 748 98 638 190 C575 242 545 263 500 286"></path>
        <path class="neural-lobby__stream neural-lobby__stream--green neural-lobby__stream--pulse" style="--i:2" d="M-55 520 C125 555 248 505 357 408 C428 345 460 319 500 286"></path>
        <path class="neural-lobby__stream neural-lobby__stream--gold neural-lobby__stream--pulse" style="--i:3" d="M1055 510 C875 550 744 502 640 406 C573 344 541 319 500 286"></path>
        <path class="neural-lobby__stream neural-lobby__stream--blue neural-lobby__stream--pulse neural-lobby__stream--secondary" style="--i:4" d="M-35 305 C132 248 280 260 392 305 C442 325 470 315 500 286"></path>
        <path class="neural-lobby__stream neural-lobby__stream--violet neural-lobby__stream--pulse neural-lobby__stream--secondary" style="--i:5" d="M1035 302 C866 244 725 255 612 305 C560 328 531 316 500 286"></path>
        <path class="neural-lobby__stream neural-lobby__stream--green neural-lobby__stream--pulse neural-lobby__stream--secondary" style="--i:6" d="M185 700 C205 590 285 498 380 408 C438 353 469 321 500 286"></path>
        <path class="neural-lobby__stream neural-lobby__stream--gold neural-lobby__stream--pulse neural-lobby__stream--secondary" style="--i:7" d="M815 700 C795 590 716 500 620 410 C563 356 531 322 500 286"></path>
      </g>
      <g class="neural-lobby__network-nodes">
        <circle style="--i:0" cx="24" cy="126" r="4"></circle><circle style="--i:1" cx="154" cy="204" r="5"></circle><circle style="--i:2" cx="286" cy="118" r="4"></circle><circle style="--i:3" cx="418" cy="232" r="5"></circle><circle style="--i:4" cx="560" cy="146" r="4"></circle><circle style="--i:5" cx="704" cy="254" r="5"></circle><circle style="--i:6" cx="846" cy="144" r="4"></circle><circle style="--i:7" cx="982" cy="224" r="4"></circle>
        <circle style="--i:8" cx="126" cy="298" r="4"></circle><circle style="--i:9" cx="260" cy="376" r="5"></circle><circle style="--i:10" cx="398" cy="302" r="4"></circle><circle style="--i:11" cx="536" cy="412" r="5"></circle><circle style="--i:12" cx="674" cy="334" r="4"></circle><circle style="--i:13" cx="826" cy="404" r="5"></circle>
        <circle style="--i:14" cx="174" cy="486" r="4"></circle><circle style="--i:15" cx="314" cy="548" r="5"></circle><circle style="--i:16" cx="444" cy="454" r="4"></circle><circle style="--i:17" cx="594" cy="548" r="5"></circle><circle style="--i:18" cx="738" cy="462" r="4"></circle><circle style="--i:19" cx="894" cy="536" r="5"></circle>
      </g>
    </svg>
    <div class="aurora-particle-field aurora-particle-field--lobby" aria-hidden="true">
      <span style="--i:0"></span><span style="--i:1"></span><span style="--i:2"></span><span style="--i:3"></span>
      <span style="--i:4"></span><span style="--i:5"></span><span style="--i:6"></span><span style="--i:7"></span>
      <span style="--i:8"></span><span style="--i:9"></span><span style="--i:10"></span><span style="--i:11"></span>
    </div>
  </div>

  <div class="neural-lobby__vignette" aria-hidden="true"></div>

  <a class="neural-lobby__corner-brand" href="#top" data-neural-lobby-link aria-label="PatroAI">
    <img src="/assets/patroai-logo-integrated.png" alt="PatroAI" />
  </a>

  <div class="neural-lobby__source-reveal" aria-label="Fontes PatroAI" data-source-reveal>
    <a href="#top" data-neural-lobby-link data-reveal-index="0"><span data-i18n="lobby.node.about">Conheça a PatroAI</span></a>
    <a href="#ecossistema" data-neural-lobby-link data-reveal-index="1"><span data-i18n="lobby.node.ecosystem">Ecossistema</span></a>
    <a href="#governanca" data-neural-lobby-link data-reveal-index="2"><span data-i18n="lobby.node.governance">Governança</span></a>
    <a href="#metodo" data-neural-lobby-link data-reveal-index="3"><span data-i18n="lobby.node.method">Método</span></a>
    <a href="#carreiras" data-neural-lobby-link data-reveal-index="4"><span data-i18n="lobby.node.careers">Carreiras &amp; Talentos</span></a>
    <a href="#contato" data-neural-lobby-link data-reveal-index="5"><span data-i18n="lobby.node.contact">Contato Estratégico</span></a>
    <a href="/app" data-neural-lobby-link data-private-entry="true" data-reveal-index="6"><span data-i18n="lobby.node.platform">Acessar Plataforma</span></a>
  </div>

  <div class="neural-lobby__center">
    <div
      class="neural-lobby__brand"
      tabindex="0"
      role="button"
      aria-label="Conduzir núcleo PatroAI"
      aria-describedby="neuralLobbyDragHint"
      data-neural-logo-control
    >
      <span class="neural-lobby__brand-halo" aria-hidden="true"></span>
      <span class="neural-lobby__brand-orbit neural-lobby__brand-orbit--outer"></span>
      <span class="neural-lobby__brand-orbit neural-lobby__brand-orbit--inner"></span>
      <img
        class="neural-lobby__logo-image"
        src="/assets/patroai-logo-integrated.png"
        alt=""
      />
    </div>

    <p class="neural-lobby__eyebrow" data-i18n="lobby.eyebrow">PATROAI · NÚCLEO IMERSIVO</p>
    <h2 data-i18n="lobby.title">Escolha por onde deseja entrar.</h2>
    <p data-i18n="lobby.copy">
      Navegue pelo ecossistema enquanto a experiência sonora permanece ativa.
    </p>
  </div>

  <nav class="neural-lobby__nodes" aria-label="Navegação imersiva">
    <a class="neural-lobby__node neural-lobby__node--a" href="#top" data-neural-lobby-link>
      <span data-i18n="lobby.node.about">Conheça a PatroAI</span>
    </a>
    <a class="neural-lobby__node neural-lobby__node--b" href="#ecossistema" data-neural-lobby-link>
      <span data-i18n="lobby.node.ecosystem">Ecossistema</span>
    </a>
    <a class="neural-lobby__node neural-lobby__node--c" href="#governanca" data-neural-lobby-link>
      <span data-i18n="lobby.node.governance">Governança</span>
    </a>
    <a class="neural-lobby__node neural-lobby__node--d" href="#metodo" data-neural-lobby-link>
      <span data-i18n="lobby.node.method">Método</span>
    </a>
    <a class="neural-lobby__node neural-lobby__node--e" href="#carreiras" data-neural-lobby-link>
      <span data-i18n="lobby.node.careers">Carreiras &amp; Talentos</span>
    </a>
    <a class="neural-lobby__node neural-lobby__node--f" href="#contato" data-neural-lobby-link>
      <span data-i18n="lobby.node.contact">Contato Estratégico</span>
    </a>
    <a
      class="neural-lobby__node neural-lobby__node--g neural-lobby__node--private"
      href="/app"
      data-neural-lobby-link
      data-private-entry="true"
    >
      <span data-i18n="lobby.node.platform">Acessar Plataforma</span>
    </a>
  </nav>

  <div class="neural-lobby__carousel" data-lobby-carousel aria-label="Fontes PatroAI">
    <button class="neural-lobby__carousel-arrow" type="button" data-carousel-step="-1" aria-label="Fonte anterior">‹</button>
    <div class="neural-lobby__carousel-viewport">
      <div class="neural-lobby__carousel-track" data-lobby-carousel-track>
        <a href="#top" class="neural-lobby__carousel-item is-active" data-neural-lobby-link data-carousel-item="0"><span data-i18n="lobby.node.about">Conheça a PatroAI</span></a>
        <a href="#ecossistema" class="neural-lobby__carousel-item" data-neural-lobby-link data-carousel-item="1"><span data-i18n="lobby.node.ecosystem">Ecossistema</span></a>
        <a href="#governanca" class="neural-lobby__carousel-item" data-neural-lobby-link data-carousel-item="2"><span data-i18n="lobby.node.governance">Governança</span></a>
        <a href="#metodo" class="neural-lobby__carousel-item" data-neural-lobby-link data-carousel-item="3"><span data-i18n="lobby.node.method">Método</span></a>
        <a href="#carreiras" class="neural-lobby__carousel-item" data-neural-lobby-link data-carousel-item="4"><span data-i18n="lobby.node.careers">Carreiras &amp; Talentos</span></a>
        <a href="#contato" class="neural-lobby__carousel-item" data-neural-lobby-link data-carousel-item="5"><span data-i18n="lobby.node.contact">Contato Estratégico</span></a>
        <a href="/app" class="neural-lobby__carousel-item neural-lobby__carousel-item--private" data-neural-lobby-link data-carousel-item="6" data-private-entry="true"><span data-i18n="lobby.node.platform">Acessar Plataforma</span></a>
      </div>
    </div>
    <button class="neural-lobby__carousel-arrow" type="button" data-carousel-step="1" aria-label="Próxima fonte">›</button>
    <div class="neural-lobby__carousel-count" aria-live="polite"><span data-carousel-current>1</span><span aria-hidden="true"> / 7</span></div>
  </div>

  <div class="neural-lobby__hint" aria-hidden="true">
    <span></span>
    <small data-i18n="lobby.hint">Selecione um núcleo para entrar</small>
  </div>
  <p class="neural-lobby__drag-hint" id="neuralLobbyDragHint" data-i18n="lobby.dragHint">
    Toque e conduza o núcleo
  </p>

  <div class="neural-lobby__transition" data-lobby-transition aria-hidden="true">
    <span class="neural-lobby__transition-beam" data-lobby-transition-beam></span>
    <span class="neural-lobby__transition-impact"></span>
    <span class="neural-lobby__transition-burst"></span>
    <span class="neural-lobby__transition-ring neural-lobby__transition-ring--a"></span>
    <span class="neural-lobby__transition-ring neural-lobby__transition-ring--b"></span>
    <span class="neural-lobby__transition-flash"></span>
  </div>
</section>

<audio
  id="patroaiImmersiveAudio"
  preload="metadata"
  src="/media/patroai-threshold.mp3"
></audio>

<aside class="music-dock" id="musicDock" hidden aria-label="Experiência sonora PatroAI">
  <div class="music-dock__pulse" aria-hidden="true"></div>
  <div class="music-dock__copy">
    <strong>Experiência sonora</strong>
    <span id="musicDockStatus">Reproduzindo obra imersiva</span>
  </div>
  <button class="music-dock__control" id="musicDockToggle" type="button" aria-label="Pausar música">
    <span data-music-icon="true" aria-hidden="true">Ⅱ</span>
  </button>
  <a
    class="music-dock__artist"
    href="https://suno.com/@daninavioficial"
    target="_blank"
    rel="noopener noreferrer"
  >
    Conheça mais obras deste artista
  </a>
</aside>

<div class="progress" aria-hidden="true"></div>
    <header class="site-header">
      <nav class="nav" aria-label="Navegação principal">
        <a class="brand brand--official" href="#top" aria-label="Grupo PatroAI">
          <span class="header-brand-mark" aria-hidden="true" data-testid="official-header-logo">
            <span class="header-brand-aura"></span>
            <span class="header-brand-orbit header-brand-orbit--outer"></span>
            <span class="header-brand-orbit header-brand-orbit--inner"></span>
            <img class="header-brand-image" src="/assets/logo-patroai-oficial.png" alt="" />
          </span>
          <span class="header-brand-copy">
            <strong>Grupo PatroAI</strong>
            <span>Consultech / Holding / AI Factory</span>
          </span>
        </a>
        <div class="nav-links" id="navLinks">
          <a href="#cocriacao" data-i18n="nav.cocreation">Cocriação</a>
          <a href="#ecossistema" data-i18n="nav.ecosystem">Ecossistema</a>
          <a href="#governanca" data-i18n="nav.governance">Governança</a>
          <a href="#metodo" data-i18n="nav.method">Método</a>
          <a href="#carreiras" data-i18n="nav.careers">Carreiras</a>
          <a href="#cocriador" data-i18n="nav.cocreator">Co-Criador</a>
          <a href="#contato" data-i18n="nav.contact">Contato</a>
        </div>
        <div class="nav-actions">
          <div class="language-switch" aria-label="Selecionar idioma">
            <button type="button" data-lang="pt" class="active" aria-pressed="true">PT</button>
            <button type="button" data-lang="es" aria-pressed="false">ES</button>
            <button type="button" data-lang="en" aria-pressed="false">EN</button>
          </div>

          <button
            class="button ghost immersive-return-button"
            type="button"
            data-return-immersive="true"
            aria-label="Voltar à experiência imersiva"
          >
            <span aria-hidden="true">↶</span>
            <span>Voltar à experiência imersiva</span>
          </button>
          <a class="button ghost" href="/app" data-private-entry="true" >Acessar Plataforma</a>
          <button class="icon-button" type="button" id="menuButton" aria-label="Abrir menu" aria-expanded="false"><span></span><span></span><span></span></button>
        </div>
      </nav>
    </header>

    <main id="main-content">
        <div id="top" aria-hidden="true"></div>
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-inner">
          <div class="hero-grid">
            <div>
              <p class="eyebrow" data-i18n="hero.eyebrow">Acesso privado e controlado</p>
              <h1 id="hero-title" data-i18n-html="hero.title">Sistemas governados de <span>IA</span> para fluxos executivos.</h1>
              <p class="hero-copy" data-i18n="hero.copy">O Grupo PatroAI une consultoria estratégica, tecnologia aplicada e desenvolvimento de novos negócios para transformar informação complexa em clareza, decisão e execução.</p>
              <div class="hero-actions">
                <a class="button primary" href="#contato" data-i18n="hero.primary">Falar com um especialista</a>
                <a class="button secondary" href="#ecossistema" data-i18n="hero.secondary">Conhecer atuação</a>
              <span id="pwaInstallSlot" class="pwa-install-slot"></span>
              </div>
              <div class="assurance" aria-label="Indicadores de confiança">
                <div class="assurance-item reveal"><strong data-count="3">0</strong><span data-i18n="hero.kpi1">frentes integradas para estratégia, capital relacional e tecnologia.</span></div>
                <div class="assurance-item reveal"><strong data-count="100">0</strong><span data-i18n="hero.kpi2">por cento orientado a governança, rastreabilidade e decisão.</span></div>
                <div class="assurance-item reveal"><strong data-count="1">0</strong><span data-i18n="hero.kpi3">ambiente privado para relacionamento qualificado e seguro.</span></div>
              </div>
            </div>

            <div class="device-stage" aria-label="Prévia visual da plataforma PatroAI">
              <div class="screen-card" id="screenCard">
                <div class="screen-top"><span>Grupo PatroAI / Executive OS</span><span>private_access=true</span></div>
                <div class="screen-body">
                  <div class="interface-panel">
                    <p class="eyebrow">Plataforma</p>
                    <h3 data-i18n="screen.title">Governança antes da automação.</h3>
                    <p data-i18n="screen.copy">Uma camada executiva para organizar dados, agentes, documentos, risco e decisão com trilhas claras de responsabilidade.</p>
                    <div class="signal-grid">
                      <div class="signal"><i></i><strong>Consultech</strong><span data-i18n="screen.signal1">Estratégia aplicada</span></div>
                      <div class="signal"><i></i><strong>Holding</strong><span data-i18n="screen.signal2">Teses e parcerias</span></div>
                      <div class="signal"><i></i><strong>AI Factory</strong><span data-i18n="screen.signal3">Sistemas sob medida</span></div>
                      <div class="signal"><i></i><strong>ESG</strong><span data-i18n="screen.signal4">Perpetuação responsável</span></div>
                    </div>
                  </div>
                  <div class="neural-stage" aria-hidden="true">
                    <canvas id="brainCanvas"></canvas>
                    <div class="brain-shell">
                      <span class="brain-lines"></span>
                      <span class="neural-brand-core">
                        <span class="neural-brand-halo"></span>
                        <span class="neural-brand-orbit"></span>
                        <img src="/assets/logo-patroai-oficial.png" alt="" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="section level-six-section" id="nucleo-imersivo" aria-labelledby="level-six-title">
        <div class="section-inner">
          <div class="level-six-panel reveal">
            <div class="level-six-panel__signal" aria-hidden="true"><span></span><span></span><span></span></div>
            <div class="level-six-panel__copy">
              <p class="eyebrow" data-i18n="level6.eyebrow">Núcleo de Inteligência Artificial Imersiva</p>
              <h2 id="level-six-title" data-i18n="level6.title">Nível 6: uma inteligência que estamos cocriando.</h2>
              <p data-i18n="level6.copy">A PatroAI pesquisa e desenvolve uma nova camada de inteligência: sistemas que conectam agentes, contexto, presença, música, interface espacial, governança e impacto humano em uma experiência viva.</p>
              <p class="level-six-panel__status" data-i18n="level6.status">Fronteira em cocriação · conceito em desenvolvimento</p>
              <a class="button secondary" href="#contato" data-i18n="level6.cta">Cocriar essa fronteira</a>
            </div>
            <div class="level-six-panel__layers" aria-label="Camadas do Núcleo de IA Imersiva">
              <span data-i18n="level6.layer.context">Contexto</span>
              <span data-i18n="level6.layer.agents">Agentes</span>
              <span data-i18n="level6.layer.presence">Presença</span>
              <span data-i18n="level6.layer.governance">Governança</span>
              <span data-i18n="level6.layer.impact">Impacto</span>
            </div>
          </div>
        </div>
      </section>

      <section class="section cocreation-section" id="cocriacao" aria-labelledby="cocreation-title">
        <div class="section-inner">
          <div class="section-head">
            <div>
              <p class="eyebrow" data-i18n="cocreation.eyebrow">Central de Cocriação</p>
              <h2 id="cocreation-title" data-i18n="cocreation.title">Onde novos negócios, startups e tecnologias ganham forma.</h2>
            </div>
            <p data-i18n="cocreation.copy">A PatroAI conecta pessoas, repertórios, capital relacional e tecnologia própria para transformar oportunidades em negócios, produtos e ecossistemas com propósito.</p>
          </div>
          <div class="unit-grid">
            <article class="unit-card reveal"><div class="unit-icon" aria-hidden="true"><span>01</span></div><h3 data-i18n="cocreation.business.title">Novos negócios</h3><p data-i18n="cocreation.business.copy">Cocriamos teses, modelos e caminhos de validação para oportunidades que precisam sair da intenção e encontrar mercado.</p></article>
            <article class="unit-card reveal"><div class="unit-icon" aria-hidden="true"><span>02</span></div><h3 data-i18n="cocreation.startups.title">Startups e produtos</h3><p data-i18n="cocreation.startups.copy">Apoiamos fundadores e equipes na construção de produtos, operações e decisões orientadas por contexto, velocidade e governança.</p></article>
            <article class="unit-card reveal"><div class="unit-icon" aria-hidden="true"><span>03</span></div><h3 data-i18n="cocreation.technology.title">Novas tecnologias</h3><p data-i18n="cocreation.technology.copy">Exploramos IA, agentes, automação e interfaces imersivas para criar capacidades que não existem prontas na prateleira.</p></article>
          </div>
          <div class="cocreation-manifesto reveal"><strong data-i18n="cocreation.manifesto.title">A boutique tailor-made é o nosso modo de entrega.</strong><span data-i18n="cocreation.manifesto.copy">A central de cocriação é o nosso campo de origem: um espaço para imaginar, estruturar, testar e lançar o próximo ciclo.</span></div>
        </div>
      </section>

      <section class="section alt" id="ecossistema" aria-labelledby="ecosystem-title">
        <div class="section-inner">
          <div class="section-head">
            <div><p class="eyebrow" data-i18n="ecosystem.eyebrow">Ecossistema PatroAI</p><h2 id="ecosystem-title" data-i18n="ecosystem.title">Três frentes para construir vantagem com critério.</h2></div>
            <p data-i18n="ecosystem.copy">A proposta combina visão executiva, estrutura de negócios e engenharia aplicada para projetos que precisam sair do discurso e entrar em operação com controle.</p>
          </div>
          <div class="unit-grid">
            <article class="unit-card reveal"><div class="unit-icon" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M5 24 16 4l11 20H5Z" /><path d="M10 22h12M13 16h6" /></svg></div><h3>Consultech</h3><p data-i18n="unit.consultech.copy">Planejamento, valuation, diagnóstico e apoio executivo para decisões de alto impacto.</p><ul><li data-i18n="unit.consultech.a">Business plan e estratégia</li><li data-i18n="unit.consultech.b">Modelagens dinâmicas de valor</li><li data-i18n="unit.consultech.c">Suporte executivo especializado</li></ul></article>
            <article class="unit-card reveal"><div class="unit-icon" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M6 26V14h5v12M14 26V7h5v19M22 26V11h5v15" /></svg></div><h3>Holding</h3><p data-i18n="unit.holding.copy">Desenvolvimento de teses, novos negócios e parcerias com potencial de escala e sinergia.</p><ul><li data-i18n="unit.holding.a">Projetos por segmento</li><li data-i18n="unit.holding.b">Conexão institucional</li><li data-i18n="unit.holding.c">Construção de oportunidades</li></ul></article>
            <article class="unit-card reveal"><div class="unit-icon" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M16 3 27 9v14l-11 6-11-6V9l11-6Z" /><path d="M5 9l11 6 11-6M16 15v14" /></svg></div><h3>AI Factory</h3><p data-i18n="unit.factory.copy">Sistemas, automações e ambientes digitais seguros para gestão, decisão e escala operacional.</p><ul><li data-i18n="unit.factory.a">IA governada para empresas</li><li data-i18n="unit.factory.b">Fluxos executivos inteligentes</li><li data-i18n="unit.factory.c">Arquitetura sob medida</li></ul></article>
          </div>
          <div class="patroai-pillars" aria-labelledby="pillars-title">
            <div class="patroai-pillars__intro">
              <p class="eyebrow" data-i18n="pillars.eyebrow">Pilares de atuação</p>
              <h3 id="pillars-title" data-i18n="pillars.title">Crescer com consciência, cocriação e impacto.</h3>
              <p data-i18n="pillars.copy">A PatroAI conecta inteligência, pessoas e responsabilidade para transformar projetos em valor compartilhado.</p>
            </div>
            <div class="patroai-pillars__grid">
              <article class="patroai-pillar reveal"><span class="patroai-pillar__index">01</span><h4 data-i18n="pillar.cocreation.title">Cocriação</h4><p data-i18n="pillar.cocreation.copy">Construímos com empreendedores, especialistas, comunidades e parceiros, convertendo repertório coletivo em soluções vivas.</p></article>
              <article class="patroai-pillar reveal"><span class="patroai-pillar__index">02</span><h4 data-i18n="pillar.esg.title">ESG</h4><p data-i18n="pillar.esg.copy">Integramos governança, responsabilidade ambiental e valor social ao desenho das decisões, operações e tecnologias.</p></article>
              <article class="patroai-pillar reveal"><span class="patroai-pillar__index">03</span><h4 data-i18n="pillar.impact.title">Impacto Social</h4><p data-i18n="pillar.impact.copy">Orientamos inovação para ampliar oportunidades, fortalecer culturas e gerar prosperidade com inclusão e continuidade.</p></article>
            </div>
          </div>
        </div>
      </section>

      <section class="section" id="governanca" aria-labelledby="governance-title">
        <div class="section-inner">
          <div class="metric-band">
            <div>
              <p class="eyebrow" data-i18n="governance.eyebrow">Governança, ESG e perpetuação</p>
              <h2 id="governance-title" data-i18n="governance.title">IA que respeita contexto, responsabilidade e continuidade.</h2>
              <ul class="check-list"><li data-i18n="governance.a">Rastreabilidade desde o desenho da solução.</li><li data-i18n="governance.b">Decisões com critério, evidências e limites operacionais.</li><li data-i18n="governance.c">Aplicação responsável para empresas, investidores e especialistas.</li><li data-i18n="governance.d">Arquitetura preparada para continuidade, escala e controle.</li></ul>
              <div class="metric-grid" aria-label="Diferenciais">
                <div class="metric-card reveal"><strong>01</strong><span data-i18n="metric.a">Diagnóstico estratégico antes de qualquer automação.</span></div>
                <div class="metric-card reveal"><strong>02</strong><span data-i18n="metric.b">Arquitetura de IA conectada ao negócio e ao risco.</span></div>
                <div class="metric-card reveal"><strong>03</strong><span data-i18n="metric.c">Rede qualificada para consultores, empresas e investidores.</span></div>
                <div class="metric-card reveal"><strong>04</strong><span data-i18n="metric.d">Operação privada, controlada e orientada a valor.</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="section alt" id="metodo" aria-labelledby="method-title">
        <div class="section-inner">
          <div class="section-head">
            <div><p class="eyebrow" data-i18n="method.eyebrow">Método de implantação</p><h2 id="method-title" data-i18n="method.title">Do briefing ao sistema governado.</h2></div>
            <p data-i18n="method.copy">A jornada prioriza aderência, confidencialidade e maturidade operacional. A tecnologia entra quando a decisão, o dado e a responsabilidade já estão claros.</p>
          </div>
          <div class="timeline">
            <article class="timeline-card reveal"><small>01</small><h3 data-i18n="timeline.a.title">Triagem estratégica</h3><p data-i18n="timeline.a.copy">Entendimento do contexto, objetivo de negócio, riscos e prioridade real da organização.</p></article>
            <article class="timeline-card reveal"><small>02</small><h3 data-i18n="timeline.b.title">Arquitetura de valor</h3><p data-i18n="timeline.b.copy">Modelagem da oportunidade, indicadores, governança e potencial de retorno operacional.</p></article>
            <article class="timeline-card reveal"><small>03</small><h3 data-i18n="timeline.c.title">Protótipo controlado</h3><p data-i18n="timeline.c.copy">Desenho do fluxo, validação com usuários-chave e limites claros de acesso e execução.</p></article>
            <article class="timeline-card reveal"><small>04</small><h3 data-i18n="timeline.d.title">Escala assistida</h3><p data-i18n="timeline.d.copy">Evolução incremental com auditoria, melhoria contínua e alinhamento executivo.</p></article>
          </div>
        </div>
      </section>

      <section class="section" id="legal" aria-labelledby="legal-title">
        <div class="section-inner">
          <div class="legal-layout">
            <div>
              <p class="eyebrow" data-i18n="legal.eyebrow">Privacidade e termos</p>
              <h2 id="legal-title" data-i18n="legal.title">Uso responsável, dados e governança.</h2>
              <p class="legal-summary" data-i18n="legal.copy">Princípios de privacidade, segurança e uso responsável orientam o ambiente PatroAI e a forma como dados, agentes e decisões são tratados.</p>
            </div>
            <div class="legal-grid">
              <details class="legal-card" open>
                <summary data-i18n="legal.privacy.title">Política de Privacidade</summary>
                <p data-i18n="legal.privacy.copy">Os dados tratados pela plataforma seguem critérios de segurança, confidencialidade e uso legítimo. Conteúdos enviados podem ser processados para análise, organização, respostas contextuais e funcionamento dos agentes.</p>
                <ul>
                  <li data-i18n="legal.privacy.a">O usuário deve enviar apenas informações e documentos que tenha direito de compartilhar.</li>
                  <li data-i18n="legal.privacy.b">Dados sensíveis devem ser tratados com cautela e somente quando necessários ao contexto.</li>
                  <li data-i18n="legal.privacy.c">Solicitações sobre privacidade, acesso, correção ou exclusão de dados podem ser encaminhadas aos administradores do projeto.</li>
                </ul>
              </details>
              <details class="legal-card">
                <summary data-i18n="legal.terms.title">Termos de Uso</summary>
                <ul>
                  <li data-i18n="legal.terms.a">A plataforma apoia agentes de inteligência artificial, automação assistida, organização de informações e suporte operacional em ambiente controlado.</li>
                  <li data-i18n="legal.terms.b">Ao utilizar os recursos, o usuário concorda com uso responsável, ético e compatível com segurança, privacidade e governança.</li>
                  <li data-i18n="legal.terms.c">É vedado uso ilegal, abusivo, fraudulento, discriminatório, invasivo ou que viole direitos de terceiros.</li>
                  <li data-i18n="legal.terms.d">Respostas de IA podem conter imprecisões e devem ser revisadas antes de decisões operacionais, jurídicas, financeiras, médicas, técnicas ou estratégicas.</li>
                  <li data-i18n="legal.terms.e">Execuções reais, escrita em repositório, criação de branch, abertura de PR, deploy ou alteração de ambiente dependem de aprovação explícita e fluxo governado.</li>
                  <li data-i18n="legal.terms.f">Durante testes, podem ocorrer instabilidades, indisponibilidades, ajustes de interface e mudanças de comportamento dos agentes.</li>
                  <li data-i18n="legal.terms.g">A plataforma é ferramenta de apoio e não substitui análise profissional especializada.</li>
                  <li data-i18n="legal.terms.h">A continuidade de uso após atualizações poderá representar concordância com a nova versão dos termos.</li>
                </ul>
              </details>
            </div>
          </div>
        </div>
      </section>

      
      <section class="premium-band" id="carreiras" aria-labelledby="careers-title">
        <div class="section-inner">
          <div class="section-heading reveal">
            <p class="eyebrow" data-i18n="careers.eyebrow">Trabalhe conosco</p>
            <h2 id="careers-title" data-i18n="careers.title">Experiência encontra inteligência.</h2>
            <p class="hero-copy" data-i18n="careers.copy">Estamos formando uma rede de profissionais capazes de compreender ambientes reais, implantar inteligência artificial com governança e acelerar a evolução de empresas.</p>
          </div>
          <div class="career-grid">
            <article class="career-card reveal">
              <span class="career-index">01</span>
              <h3 data-i18n="careers.consulting.title">Consultores de implantação de IA</h3>
              <p data-i18n="careers.consulting.copy">Executivos, especialistas de setor e profissionais experientes para diagnóstico, desenho de processos, implantação e adoção de IA.</p>
              <a href="#contato" class="text-link" data-i18n="careers.consulting.cta">Quero atuar como consultor →</a>
            </article>
            <article class="career-card reveal">
              <span class="career-index">02</span>
              <h3 data-i18n="careers.engineering.title">Engenharia &amp; IA</h3>
              <p data-i18n="careers.engineering.copy">Software, agentes, dados, infraestrutura, segurança e produto para construir a próxima camada do ecossistema PatroAI.</p>
              <a href="#contato" class="text-link" data-i18n="careers.engineering.cta">Quero construir com a PatroAI →</a>
            </article>
            <article class="career-card reveal">
              <span class="career-index">03</span>
              <h3 data-i18n="careers.partnerships.title">Comercial &amp; Parcerias</h3>
              <p data-i18n="careers.partnerships.copy">Venda consultiva B2B, desenvolvimento de negócios e relacionamento estratégico.</p>
              <a href="#contato" class="text-link" data-i18n="careers.partnerships.cta">Quero desenvolver negócios →</a>
            </article>
            <article class="career-card reveal">
              <span class="career-index">04</span>
              <h3 data-i18n="careers.talent.title">Banco de talentos</h3>
              <p data-i18n="careers.talent.copy">Perfis multidisciplinares para projetos, programas de formação e futuras oportunidades.</p>
              <a href="#contato" class="text-link" data-i18n="careers.talent.cta">Entrar no banco de talentos →</a>
            </article>
          </div>
          <div class="preview-note reveal">
            <strong data-i18n="careers.note">As candidaturas passam por triagem qualificada, consentimento e análise de aderência ao ecossistema PatroAI.</strong>
          </div>
        </div>
      </section>

      <section class="premium-band migration-band" id="cocriador" aria-labelledby="cocriador-title">
        <div class="section-inner migration-grid">
          <div class="reveal">
            <p class="eyebrow" data-i18n="cocreator.eyebrow">Hyper Co-Criador</p>
            <h2 id="cocriador-title" data-i18n="cocreator.title">Um parceiro criativo para pensar e construir negócios com você.</h2>
            <p class="hero-copy" data-i18n="cocreator.copy">
              Um único Co-Criador combina estratégia, produto, finanças, marketing, vendas,
              operações, tecnologia e inovação para transformar ideias e desafios em hipóteses,
              decisões, documentos, análises e próximos passos.
            </p>
            <div class="hero-actions">
              <a class="button primary" href="/access" data-private-entry="true">Acessar Plataforma</a>
            </div>
          </div>
          <div class="migration-card reveal">
            <span class="migration-kicker" data-i18n="cocreator.kicker">Um agente · múltiplas capacidades</span>
            <div class="migration-flow">
              <span>Ideia</span><i></i><span>Análise</span><i></i><span>Criação</span><i></i><span>Execução</span>
            </div>
            <p data-i18n="cocreator.note">
              Arquivos, artefatos, voz, realtime e histórico usam as capacidades governadas
              já disponíveis na Plataforma. A evolução da própria Plataforma permanece
              restrita ao plano administrativo.
            </p>
          </div>
        </div>
      </section>

<section class="section" id="contato" aria-labelledby="contact-title">
        <div class="section-inner">
          <div class="contact-grid">
            <div>
              <p class="eyebrow" data-i18n="contact.eyebrow">Pré-onboarding qualificado</p>
              <h2 id="contact-title" data-i18n="contact.title">Converse com a PatroAI.</h2>
              <p class="hero-copy" data-i18n="contact.copy">Use este canal para oportunidades estratégicas, acesso privado, implantação, parcerias ou interesse profissional. Conte o contexto em poucas linhas e nossa equipe retornará após uma triagem inicial.</p>
              <div class="hero-actions"><a class="button secondary" href="https://wa.me/5551989697605?text=Ol%C3%A1%2C%20Grupo%20PatroAI.%20Gostaria%20de%20falar%20sobre%20uma%20oportunidade%20estrat%C3%A9gica." data-i18n="contact.whatsapp">WhatsApp estratégico</a></div>
            </div>
            <form class="form-wrap" id="leadForm">
              <div class="field-grid">
                <label><span data-i18n="form.name">Nome completo</span><input name="nome" autocomplete="name" required /></label>
                <label><span data-i18n="form.email">E-mail</span><input name="email" type="email" autocomplete="email" required /></label>
                <label><span data-i18n="form.profile">Perfil</span><select name="perfil" required><option value="" data-i18n="form.select">Selecione</option><option data-i18n="form.profileA">Empresa / Cliente</option><option data-i18n="form.profileB">Investidor</option><option data-i18n="form.profileC">Consultor associado</option><option data-i18n="form.profileD">Parceiro estratégico</option></select></label>
                <label><span data-i18n="form.whatsapp">WhatsApp</span><input name="whatsapp" autocomplete="tel" required /></label>
                <label class="full"><span data-i18n="form.challenge">Oportunidade ou desafio</span><textarea name="mensagem" required></textarea></label>
              </div>
              <button class="button primary" type="submit" data-i18n="form.submit">Preparar contato</button>
              <p class="form-status" id="formStatus" role="status"></p>
            </form>
          </div>
        </div>
      </section>
    </main>

    <footer class="footer">
      <div class="footer-inner">
        <span data-i18n="footer.left">Grupo PatroAI. Consultech, Holding e AI Factory.</span>
        <span class="footer-links"><a href="#legal" data-i18n="footer.privacy">Privacidade e termos</a><a href="#contato" data-i18n="footer.contact">Contato</a></span>
        <span data-i18n="footer.right">Acesso privado. Proposta sob análise.</span>
      </div>
    </footer>
`;
