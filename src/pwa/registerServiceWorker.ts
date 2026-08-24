export const UPDATE_EVENT = "patroai:pwa-update";
export const REGISTRATION_ERROR_EVENT = "patroai:pwa-registration-error";

type WaitingUpdateDetail = {
  registration: ServiceWorkerRegistration;
  waiting: ServiceWorker;
  version?: string;
};

function dispatchWaitingUpdate(
  registration: ServiceWorkerRegistration,
  waiting: ServiceWorker,
): void {
  const detail: WaitingUpdateDetail = {
    registration,
    waiting,
    version: waiting.scriptURL,
  };
  window.dispatchEvent(
    new CustomEvent<WaitingUpdateDetail>(UPDATE_EVENT, { detail }),
  );
}

function observeInstallingWorker(
  registration: ServiceWorkerRegistration,
): void {
  const worker = registration.installing;
  if (!worker) return;

  worker.addEventListener("statechange", () => {
    if (
      worker.state === "installed" &&
      navigator.serviceWorker.controller &&
      registration.waiting
    ) {
      dispatchWaitingUpdate(registration, registration.waiting);
    }
  });
}


function isLegacyPwaLaunch(): boolean {
  const url = new URL(window.location.href);
  return (
    url.pathname === "/app" &&
    (url.searchParams.get("source") || "").startsWith("pwa")
  );
}

function installV8ControllerMigration(): void {
  const legacyPwaLaunch = isLegacyPwaLaunch();

  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    if (legacyPwaLaunch) {
      window.location.replace("/?source=pwa");
    }
  });
}

export async function registerServiceWorker(): Promise<void> {
  if (isLegacyPwaLaunch()) {
    window.location.replace("/?source=pwa&experience=immersive&v=10");
    return;
  }
  if (!("serviceWorker" in navigator)) return;
  installV8ControllerMigration();

  const localHostnames = new Set(["localhost", "127.0.0.1", "::1"]);
  if (
    window.location.protocol !== "https:" &&
    !localHostnames.has(window.location.hostname)
  ) {
    return;
  }

  window.addEventListener(
    "load",
    async () => {
      try {
        const registration = await navigator.serviceWorker.register(
          "/sw.js",
          {
            scope: "/",
            updateViaCache: "none",
          },
        );

        if (registration.waiting && navigator.serviceWorker.controller) {
          if (isLegacyPwaLaunch()) {
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          } else {
            dispatchWaitingUpdate(registration, registration.waiting);
          }
        }

        registration.addEventListener("updatefound", () => {
          observeInstallingWorker(registration);
        });

        await registration.update();
      } catch (error) {
        window.dispatchEvent(
          new CustomEvent(REGISTRATION_ERROR_EVENT, {
            detail: {
              message:
                error instanceof Error
                  ? error.message
                  : "Unknown service worker registration error",
            },
          }),
        );
        console.warn("[PWA] service worker registration failed", error);
      }
    },
    { once: true },
  );
}
