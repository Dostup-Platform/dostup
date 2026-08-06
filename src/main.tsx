import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// PWA error recovery: if chunks fail to load, clear cache and reload
window.addEventListener("error", (event) => {
  if (
    event.message?.includes("Failed to fetch dynamically imported module") ||
    event.message?.includes("Loading chunk") ||
    event.message?.includes("Loading CSS chunk")
  ) {
    console.warn("Chunk load error detected, clearing caches and reloading...");
    if ("caches" in window) {
      caches.keys().then((names) => {
        Promise.all(names.map((name) => caches.delete(name))).then(() => {
          globalThis.location.reload();
        });
      });
    } else {
      globalThis.location.reload();
    }
  }
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = (event.reason as Error)?.message || String(event.reason);
  if (
    reason.includes("Failed to fetch dynamically imported module") ||
    reason.includes("Loading chunk")
  ) {
    console.warn("Chunk load rejection detected, clearing caches and reloading...");
    if ("caches" in window) {
      caches.keys().then((names) => {
        Promise.all(names.map((name) => caches.delete(name))).then(() => {
          globalThis.location.reload();
        });
      });
    } else {
      globalThis.location.reload();
    }
  }
});

// Register PWA service worker with auto-update
const updateSW = registerSW({
  onNeedRefresh() {
    updateSW(true);
  },
  onOfflineReady() {
    console.log("App ready to work offline");
  },
});

createRoot(document.getElementById("root")!).render(<App />);
