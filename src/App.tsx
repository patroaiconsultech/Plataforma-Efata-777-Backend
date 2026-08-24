import React from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import Landing from "./routes/Landing";
import AppConsole from "./routes/AppConsole";
import InviteAccept from "./routes/InviteAccept";
import AccessPortal from "./routes/AccessPortal";
import AdminPanel from "./routes/AdminPanel";
import PwaUpdateBanner from "./components/PwaUpdateBanner";
import "./styles.css";


function AppEntry() {
  const source = new URLSearchParams(window.location.search).get("source") || "";
  if (source.startsWith("pwa")) {
    return <Navigate to="/?source=pwa" replace />;
  }
  return <AppConsole />;
}

export default function App() {
  return (
    <BrowserRouter>
      <a className="skip-link" href="#main-content">
        Ir para o conteúdo
      </a>
      <PwaUpdateBanner />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<AppEntry />} />
        <Route path="/access" element={<AccessPortal />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/invite/:token" element={<InviteAccept />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
