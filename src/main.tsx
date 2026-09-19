import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Registra o service worker (necessário para instalar o app no desktop/celular).
// Não faz cache de HTML/JS não versionado, então nunca deixa o sistema desatualizado.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => reg.update())
      .catch(() => {
        /* instalação do app indisponível neste navegador */
      });
  });
}
