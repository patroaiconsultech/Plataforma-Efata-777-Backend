import { Component, type ErrorInfo, type ReactNode } from "react";

const RUNTIME_ERROR_EVENT = "patroai:runtime-error";

type RuntimeErrorBoundaryProps = {
  children: ReactNode;
};

type RuntimeErrorBoundaryState = {
  hasError: boolean;
};

type RuntimeErrorEventDetail = {
  source?: string;
  error?: unknown;
};

function getErrorName(value: unknown): string {
  return value !== null &&
    typeof value === "object" &&
    "name" in value
    ? String((value as { name?: unknown }).name || "")
    : "";
}

function getErrorMessage(value: unknown): string {
  if (typeof value === "string") return value;
  if (
    value !== null &&
    typeof value === "object" &&
    "message" in value
  ) {
    return String((value as { message?: unknown }).message || "");
  }
  return "";
}

function isAbortError(value: unknown): boolean {
  return getErrorName(value) === "AbortError";
}

function isBenignBrowserRuntimeError(value: unknown): boolean {
  const message = getErrorMessage(value).toLowerCase();
  const name = getErrorName(value);

  // Chromium/Samsung Internet can emit these as global `error` events even
  // though rendering continues normally. They must never replace the landing.
  if (
    message.includes("resizeobserver loop limit exceeded") ||
    message.includes("resizeobserver loop completed with undelivered notifications")
  ) {
    return true;
  }

  // Media playback is optional on the public immersive landing. Browser
  // autoplay/pipeline restrictions must degrade to silent mode, not crash UI.
  if (
    window.location.pathname === "/" &&
    (name === "NotAllowedError" ||
      name === "NotSupportedError" ||
      name === "InvalidStateError")
  ) {
    return true;
  }

  return false;
}

export default class RuntimeErrorBoundary extends Component<
  RuntimeErrorBoundaryProps,
  RuntimeErrorBoundaryState
> {
  state: RuntimeErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RuntimeErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("PatroAI runtime error", error, info.componentStack);
  }

  componentDidMount() {
    window.addEventListener("error", this.handleGlobalError);
    window.addEventListener("unhandledrejection", this.handleUnhandledRejection);
    window.addEventListener(RUNTIME_ERROR_EVENT, this.handleRuntimeError);
  }

  componentWillUnmount() {
    window.removeEventListener("error", this.handleGlobalError);
    window.removeEventListener("unhandledrejection", this.handleUnhandledRejection);
    window.removeEventListener(RUNTIME_ERROR_EVENT, this.handleRuntimeError);
  }

  private trip = (error: unknown, source: string) => {
    if (this.state.hasError || isBenignBrowserRuntimeError(error)) return;
    console.error(`PatroAI ${source}`, error);
    this.setState((current) =>
      current.hasError ? null : { hasError: true },
    );
  };

  private handleGlobalError = (event: ErrorEvent) => {
    const value = event.error || event.message;
    if (!value || isBenignBrowserRuntimeError(value)) return;

    // The public landing is a progressive-enhancement surface. Samsung
    // Internet/Chromium can surface GPU/media/observer exceptions globally
    // even when the gate itself is still usable. Never replace the public
    // entry with the console recovery screen because of an optional effect.
    if (window.location.pathname === "/") {
      console.warn("PatroAI non-fatal landing browser diagnostic · public landing runtime diagnostic", value);
      return;
    }

    this.trip(value, "global runtime error");
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    // AbortController cancellation is expected. On the public landing,
    // asynchronous audio/WebGL failures are progressive-enhancement failures
    // and must not destroy the gate or navigation.
    if (isAbortError(event.reason) || isBenignBrowserRuntimeError(event.reason)) return;
    if (window.location.pathname === "/") {
      console.warn("PatroAI non-fatal public landing rejection", event.reason);
      return;
    }
    this.trip(event.reason, "unhandled rejection");
  };

  private handleRuntimeError = (event: Event) => {
    const detail =
      event instanceof CustomEvent
        ? (event.detail as RuntimeErrorEventDetail | undefined)
        : undefined;
    this.trip(detail?.error ?? detail ?? event, detail?.source || "runtime event");
  };

  private recover = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isPublicLanding = window.location.pathname === "/";

    return (
      <main className="runtime-error-screen" role="alert" aria-live="assertive">
        <div className="runtime-error-card">
          <span className="runtime-error-card__eyebrow">
            {isPublicLanding ? "PatroAI · Experiência" : "PatroAI Command Center"}
          </span>
          <h1>
            {isPublicLanding
              ? "Vamos recuperar a experiência."
              : "Vamos retomar sua sessão."}
          </h1>
          <p>
            {isPublicLanding
              ? "O navegador interrompeu um efeito visual da experiência. Recarregue a página ou siga para o portal de acesso."
              : "Encontramos uma interrupção temporária ao carregar o console. Sua sessão não foi apagada. Tente recarregar a plataforma ou voltar ao portal de acesso."}
          </p>
          <div className="runtime-error-card__actions">
            <button type="button" className="primary-button" onClick={this.recover}>
              {isPublicLanding ? "Recarregar experiência" : "Recarregar console"}
            </button>
            <a className="secondary-button" href="/access">
              Abrir portal de acesso
            </a>
            {!isPublicLanding ? (
              <a className="text-button" href="/">
                Voltar à página inicial
              </a>
            ) : null}
          </div>
        </div>
      </main>
    );
  }
}
