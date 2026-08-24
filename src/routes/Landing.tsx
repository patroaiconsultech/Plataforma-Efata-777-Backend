import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import PwaInstallButton from "../components/PwaInstallButton";
import { premiumMarkup } from "../landing/premiumMarkup";
import { mountPremiumLanding } from "../landing/premiumInteractions";
import "../landing/premium.css";

export default function Landing() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [pwaSlot, setPwaSlot] = useState<HTMLElement | null>(null);
  const [mountFailed, setMountFailed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    try {
      const cleanup = mountPremiumLanding({
        root,
        onPwaSlot: setPwaSlot,
        onPrivateAccess: async () => {
          navigate("/access");
        },
      });
      setMountFailed(false);
      return cleanup;
    } catch (error) {
      // Public entry must remain usable even if an optional immersive
      // enhancement is unsupported by a mobile browser/GPU.
      console.error("PatroAI landing enhancement mount failed", error);
      setMountFailed(true);
      return undefined;
    }
  }, [navigate]);

  return (
    <>
      <div
        ref={rootRef}
        className="patroai-premium"
        // The HTML is immutable source-controlled Wave 1 content.
        // No user input is interpolated into this string.
        dangerouslySetInnerHTML={{ __html: premiumMarkup }}
      />
      {mountFailed ? (
        <div className="landing-safe-recovery" role="status" aria-live="polite">
          <div className="landing-safe-recovery__card">
            <span>PatroAI · Experiência</span>
            <h1>Seu navegador entrou em modo compatível.</h1>
            <p>
              Um efeito imersivo não pôde ser iniciado neste dispositivo, mas o
              acesso à plataforma continua disponível.
            </p>
            <button type="button" onClick={() => window.location.reload()}>
              Tentar experiência novamente
            </button>
            <button type="button" onClick={() => navigate("/access")}>
              Abrir portal de acesso
            </button>
          </div>
        </div>
      ) : null}
      {pwaSlot
        ? createPortal(<PwaInstallButton compact />, pwaSlot)
        : null}
    </>
  );
}
