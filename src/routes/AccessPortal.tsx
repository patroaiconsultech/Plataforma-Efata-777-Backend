import React, { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ApiError,
  nativeBootstrapOwner,
  nativeForgotPassword,
  nativeLogin,
  nativeRegister,
  nativeResetPassword,
  validateAccessCode,
} from "../api";
import "../access.css";

export const ONBOARDING_DRAFT_KEY = "patroai_hyper_cocreator_onboarding";

type Mode = "login" | "register" | "bootstrap" | "forgot" | "reset";
type RegisterStep = "code" | "cocreator" | "objective" | "credentials";

const GOALS = [
  "Criar uma nova oferta",
  "Repensar meu modelo de negócio",
  "Resolver um desafio operacional",
  "Explorar uma ideia ainda crua",
];

function storeDraft(input: {
  grant: string;
  co_creator_name: string;
  onboarding_goal: string;
}) {
  sessionStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(input));
}

function friendlyAuthError(error: unknown): string {
  const code = error instanceof ApiError ? error.code : "NETWORK_ERROR";
  const messages: Record<string, string> = {
    INVALID_CREDENTIALS:
      "E-mail ou senha não conferem. Revise os dados e tente novamente.",
    ACCOUNT_TEMPORARILY_LOCKED:
      "Por segurança, esse acesso foi pausado por alguns minutos.",
    NATIVE_AUTH_DISABLED:
      "O acesso próprio da PatroAI ainda não está ativo nesta implantação.",
    NATIVE_BOOTSTRAP_FORBIDDEN:
      "A chave de configuração inicial não foi aceita.",
    NATIVE_BOOTSTRAP_ALREADY_COMPLETED:
      "A primeira conta segura da PatroAI já foi configurada.",
    PASSWORD_TOO_SHORT:
      "Use uma senha mais longa. A configuração atual exige pelo menos 12 caracteres.",
    NETWORK_ERROR:
      "Não foi possível alcançar a plataforma agora. Verifique a conexão e tente novamente.",
  };
  return messages[code] || `Não foi possível concluir a operação (${code}).`;
}

function friendlyAccessCodeError(error: unknown): string {
  const code = error instanceof ApiError ? error.code : "NETWORK_ERROR";
  const messages: Record<string, string> = {
    ACCESS_CODE_INVALID: "Código não reconhecido.",
    ACCESS_GATE_DISABLED:
      "O cadastro por código ainda não está habilitado nesta implantação.",
    ACCESS_GATE_NOT_CONFIGURED:
      "O acesso por código está habilitado, mas os códigos ainda não foram configurados.",
    NETWORK_ERROR:
      "Não foi possível alcançar o backend para validar o código.",
  };
  return messages[code] || `Não foi possível validar o código (${code}).`;
}

export default function AccessPortal() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<RegisterStep>("code");
  const [grant, setGrant] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [issuedResetToken, setIssuedResetToken] = useState("");
  const [bootstrapSecret, setBootstrapSecret] = useState("");
  const [tenantId, setTenantId] = useState("patroai");
  const [tenantName, setTenantName] = useState("Grupo PatroAI");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "reset") {
      setMode("reset");
      const token = params.get("token");
      if (token) setResetToken(token);
    }
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    if (next === "register") setStep("code");
  }

  async function submitLogin(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password || busy) return;
    setBusy(true);
    setError("");
    try {
      await nativeLogin({ email: email.trim(), password });
      navigate("/app", { replace: true });
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  function passwordsMatch(): boolean {
    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return false;
    }
    return true;
  }

  async function submitBootstrap(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password || !bootstrapSecret.trim() || busy) return;
    if (!passwordsMatch()) return;
    setBusy(true);
    setError("");
    try {
      await nativeBootstrapOwner({
        bootstrap_secret: bootstrapSecret.trim(),
        tenant_id: tenantId.trim() || "patroai",
        tenant_name: tenantName.trim() || "Grupo PatroAI",
        email: email.trim(),
        display_name: displayName.trim() || email.trim(),
        password,
      });
      navigate("/app", { replace: true });
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await validateAccessCode(code.trim());
      setGrant(response.grant);
      setStep("cocreator");
    } catch (err) {
      setError(friendlyAccessCodeError(err));
    } finally {
      setBusy(false);
    }
  }

  function submitName(event: FormEvent) {
    event.preventDefault();
    const clean = name.trim();
    if (clean.length < 2) return;
    setName(clean);
    setStep("objective");
  }

  function continueToIdentity() {
    if (!grant || !name || !goal) return;
    storeDraft({ grant, co_creator_name: name, onboarding_goal: goal });
    setStep("credentials");
    setError("");
  }

  async function submitRegister(event: FormEvent) {
    event.preventDefault();
    if (!grant || !name || !goal || !email.trim() || !password || busy) return;
    if (!passwordsMatch()) return;
    setBusy(true);
    setError("");
    try {
      await nativeRegister({
        grant,
        email: email.trim(),
        display_name: displayName.trim() || email.trim(),
        password,
        co_creator_name: name,
        onboarding_goal: goal,
      });
      sessionStorage.removeItem(ONBOARDING_DRAFT_KEY);
      navigate("/app?onboarding=1", { replace: true });
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitForgot(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError("");
    setIssuedResetToken("");
    try {
      const response = await nativeForgotPassword({ email: email.trim() });
      if (response.reset_token) {
        setIssuedResetToken(response.reset_token);
        setResetToken(response.reset_token);
      }
      setError("Se houver uma conta para este e-mail, enviaremos as instruções de redefinição.");
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitReset(event: FormEvent) {
    event.preventDefault();
    if (!resetToken.trim() || !password || busy) return;
    if (!passwordsMatch()) return;
    setBusy(true);
    setError("");
    try {
      await nativeResetPassword({
        token: resetToken.trim(),
        password,
        password_confirm: confirmPassword,
      });
      setMode("login");
      setPassword("");
      setConfirmPassword("");
      setError("Senha redefinida. Entre novamente com sua nova credencial.");
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="access-portal" id="main-content">
      <div className="access-portal__glow" aria-hidden="true" />
      <section className="access-card" aria-labelledby="access-title">
        <Link className="access-card__back" to="/">Voltar à experiência</Link>
        <p className="access-eyebrow">PATROAI · ACESSO PROTEGIDO</p>
        <h1 id="access-title">Entre no núcleo PatroAI.</h1>
        <p className="access-lead">
          Sua sessão é protegida por cookie seguro, senha hasheada no servidor e
          autorização canônica por membership. Sem token sensível exposto no navegador.
        </p>

        <div className="access-tabs" role="tablist" aria-label="Modo de acesso">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => switchMode("login")}
          >
            Entrar
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => switchMode("register")}
          >
            Código
          </button>
          <button
            type="button"
            className={mode === "bootstrap" ? "active" : ""}
            onClick={() => switchMode("bootstrap")}
          >
            Primeira conta
          </button>
        </div>

        {mode === "login" ? (
          <form className="access-step" onSubmit={submitLogin}>
            <span>SESSÃO PATROAI</span>
            <h2>Bem-vindo de volta.</h2>
            <p>
              Use sua credencial PatroAI. A sessão será criada no backend e mantida
              em cookie HttpOnly.
            </p>
            <label>
              <span>E-mail</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                inputMode="email"
                placeholder="voce@empresa.com"
              />
            </label>
            <label>
              <span>Senha</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                type={showPassword ? "text" : "password"}
                placeholder="Sua senha"
              />
            </label>
            <button className="access-text-button" type="button" onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? "Ocultar senha" : "Mostrar senha"}
            </button>
            <button className="access-primary" disabled={busy}>
              {busy ? "Abrindo sessão..." : "Entrar com segurança"}
            </button>
            <button className="access-text-button" type="button" onClick={() => switchMode("forgot")}>
              Esqueci minha senha
            </button>
          </form>
        ) : null}

        {mode === "forgot" ? (
          <form className="access-step" onSubmit={submitForgot}>
            <span>RECUPERAÇÃO</span>
            <h2>Vamos recuperar seu acesso.</h2>
            <p>Informe o e-mail da conta. Se ela existir, a plataforma emitirá uma instrução segura de redefinição.</p>
            <label>
              <span>E-mail</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" inputMode="email" />
            </label>
            <button className="access-primary" disabled={busy}>{busy ? "Preparando..." : "Solicitar redefinição"}</button>
            {issuedResetToken ? (
              <p className="access-note">Token de teste/staging: {issuedResetToken}</p>
            ) : null}
            <button className="access-text-button" type="button" onClick={() => switchMode("reset")}>Já tenho um token</button>
          </form>
        ) : null}

        {mode === "reset" ? (
          <form className="access-step" onSubmit={submitReset}>
            <span>NOVA SENHA</span>
            <h2>Defina uma nova senha.</h2>
            <label>
              <span>Token</span>
              <input value={resetToken} onChange={(event) => setResetToken(event.target.value)} autoComplete="off" />
            </label>
            <label>
              <span>Nova senha</span>
              <input value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" type={showPassword ? "text" : "password"} />
            </label>
            <label>
              <span>Repetir nova senha</span>
              <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" type={showConfirmPassword ? "text" : "password"} />
            </label>
            <div className="access-inline-actions">
              <button className="access-text-button" type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Ocultar senha" : "Mostrar senha"}</button>
              <button className="access-text-button" type="button" onClick={() => setShowConfirmPassword((value) => !value)}>{showConfirmPassword ? "Ocultar repetição" : "Mostrar repetição"}</button>
            </div>
            <button className="access-primary" disabled={busy}>{busy ? "Redefinindo..." : "Redefinir senha"}</button>
          </form>
        ) : null}

        {mode === "bootstrap" ? (
          <form className="access-step" onSubmit={submitBootstrap}>
            <span>CONFIGURAÇÃO INICIAL</span>
            <h2>Crie a primeira conta segura.</h2>
            <p>
              Use apenas uma vez, com a chave temporária definida no ambiente do
              backend. Depois da primeira credencial, esta porta se fecha.
            </p>
            <div className="access-grid">
              <label>
                <span>Chave inicial</span>
                <input
                  value={bootstrapSecret}
                  onChange={(event) => setBootstrapSecret(event.target.value)}
                  autoComplete="off"
                  type="password"
                  placeholder="PLATFORM_NATIVE_BOOTSTRAP_SECRET"
                />
              </label>
              <label>
                <span>Nome</span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="name"
                  placeholder="Seu nome"
                />
              </label>
              <label>
                <span>E-mail</span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  placeholder="admin@patroai.com"
                />
              </label>
              <label>
                <span>Senha</span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo de 12 caracteres"
                />
              </label>
              <label>
                <span>Repetir senha</span>
                <input
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repita a senha"
                />
              </label>
              <label>
                <span>Tenant ID</span>
                <input value={tenantId} onChange={(event) => setTenantId(event.target.value)} />
              </label>
              <label>
                <span>Tenant</span>
                <input value={tenantName} onChange={(event) => setTenantName(event.target.value)} />
              </label>
            </div>
            <button className="access-primary" disabled={busy}>
              {busy ? "Configurando..." : "Criar primeira conta"}
            </button>
            <div className="access-inline-actions">
              <button className="access-text-button" type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Ocultar senha" : "Mostrar senha"}</button>
              <button className="access-text-button" type="button" onClick={() => setShowConfirmPassword((value) => !value)}>{showConfirmPassword ? "Ocultar repetição" : "Mostrar repetição"}</button>
            </div>
          </form>
        ) : null}

        {mode === "register" && step === "code" ? (
          <form className="access-step" onSubmit={submitCode}>
            <span>ETAPA 1 DE 3</span>
            <h2>Informe seu código de acesso.</h2>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="off"
              placeholder="Código de acesso"
            />
            <button className="access-primary" disabled={busy}>
              {busy ? "Validando..." : "Validar código"}
            </button>
          </form>
        ) : null}

        {mode === "register" && step === "cocreator" ? (
          <form className="access-step" onSubmit={submitName}>
            <span>ETAPA 2 DE 3</span>
            <h2>Dê um nome ao seu Co-Criador.</h2>
            <p>Esse nome acompanha a experiência e pode ser ajustado depois.</p>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={64}
              placeholder="Ex.: Atlas, Sophia, Nexo..."
            />
            <button className="access-primary">Continuar</button>
          </form>
        ) : null}

        {mode === "register" && step === "objective" ? (
          <div className="access-step">
            <span>ETAPA 3 DE 3</span>
            <h2>O que vocês vão cocriar primeiro?</h2>
            <div className="access-goals">
              {GOALS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={goal === item ? "selected" : ""}
                  onClick={() => setGoal(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="access-primary"
              disabled={!goal}
              onClick={continueToIdentity}
            >
              Continuar para credencial
            </button>
          </div>
        ) : null}

        {mode === "register" && step === "credentials" ? (
          <form className="access-step" onSubmit={submitRegister}>
            <span>CREDENCIAL PATROAI</span>
            <h2>Crie sua credencial segura.</h2>
            <label>
              <span>Nome</span>
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" placeholder="Seu nome" />
            </label>
            <label>
              <span>E-mail</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" inputMode="email" placeholder="voce@empresa.com" />
            </label>
            <label>
              <span>Senha</span>
              <input value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" type={showPassword ? "text" : "password"} placeholder="Mínimo de 12 caracteres" />
            </label>
            <label>
              <span>Repetir senha</span>
              <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" type={showConfirmPassword ? "text" : "password"} placeholder="Repita a senha" />
            </label>
            <div className="access-inline-actions">
              <button className="access-text-button" type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Ocultar senha" : "Mostrar senha"}</button>
              <button className="access-text-button" type="button" onClick={() => setShowConfirmPassword((value) => !value)}>{showConfirmPassword ? "Ocultar repetição" : "Mostrar repetição"}</button>
            </div>
            <button className="access-primary" disabled={busy}>{busy ? "Criando conta..." : "Criar conta e entrar"}</button>
          </form>
        ) : null}

        {error ? <p className="access-error" role="alert">{error}</p> : null}
      </section>
    </main>
  );
}
