import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, acceptInvite, getNativeSession, isApiBaseConfigured } from "../api";

type State = "idle" | "working" | "accepted" | "failed";

/**
 * Destino dos links de convite. Antes desta rota, um convite gerado caía
 * no catch-all e era redirecionado para a landing sem explicação.
 */
export default function InviteAccept() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>("idle");
  const [detail, setDetail] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const configured = isApiBaseConfigured();

  useEffect(() => {
    if (!configured) {
      setCheckingSession(false);
      return;
    }
    let active = true;
    getNativeSession()
      .then((session) => {
        if (active) setAuthenticated(Boolean(session.authenticated));
      })
      .catch(() => {
        if (active) setAuthenticated(false);
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, [configured]);

  useEffect(() => {
    if (!configured || checkingSession || !authenticated || !token || state !== "idle") return;
    let active = true;
    setState("working");
    acceptInvite(token)
      .then((result) => {
        if (!active) return;
        setState("accepted");
        navigate(`/app?thread=${encodeURIComponent(result.thread_id)}`, {
          replace: true,
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const code = error instanceof ApiError ? error.code : "ERRO";
        const table: Record<string, string> = {
          INVITATION_NOT_FOUND: "Convite inválido ou inexistente.",
          INVITATION_EXPIRED: "Este convite expirou.",
          INVITATION_ALREADY_USED: "Este convite já foi utilizado.",
          INVITATION_EMAIL_MISMATCH:
            "Este convite foi emitido para outro endereço de e-mail.",
          PRINCIPAL_NOT_PROVISIONED:
            "Sua identidade ainda não está provisionada nesta organização.",
        };
        setDetail(table[code] || `Não foi possível aceitar o convite (${code}).`);
        setState("failed");
      });
    return () => {
      active = false;
    };
  }, [authenticated, checkingSession, configured, navigate, state, token]);

  return (
    <main id="main-content" className="invite-shell">
      <h1>Convite para conversa</h1>
      {!configured ? (
        <p role="alert">A URL da API não está configurada nesta implantação.</p>
      ) : checkingSession ? (
        <p role="status">Verificando sua sessão.</p>
      ) : !token ? (
        <p role="alert">Link de convite incompleto.</p>
      ) : !authenticated ? (
        <div role="alert">
          <p>
            Autentique-se para aceitar este convite. O link permanece válido até a data de expiração.
          </p>
          <Link className="primary-button" to="/access">
            Entrar para aceitar
          </Link>
        </div>
      ) : state === "working" ? (
        <p role="status">Validando o convite.</p>
      ) : state === "failed" ? (
        <p role="alert">{detail}</p>
      ) : (
        <p role="status">Convite aceito. Redirecionando.</p>
      )}
      <Link className="ghost-link" to="/">
        Voltar ao início
      </Link>
    </main>
  );
}
