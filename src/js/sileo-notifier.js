import React from "https://esm.sh/react@18.3.1?bundle";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client?bundle";
import { Toaster, sileo } from "https://esm.sh/sileo@0.1.0?bundle&deps=react@18.3.1,react-dom@18.3.1";

const ROOT_ID = "sileoToastRoot";
const EVENT_NAME = "dplab:notify";

function ensureRoot() {
  let node = document.getElementById(ROOT_ID);
  if (!node) {
    node = document.createElement("div");
    node.id = ROOT_ID;
    document.body.appendChild(node);
  }
  return node;
}

function renderToaster() {
  const root = createRoot(ensureRoot());
  root.render(React.createElement(Toaster, { position: "top-center", offset: 6 }));
}

function normalizePayload(detail) {
  const title = detail?.title || "Notificación";
  const description = detail?.description || "";
  const type = detail?.type || "info";
  return { title, description, type };
}

function notifyPayload(payloadLike) {
  const payload = normalizePayload(payloadLike);
  const opts = {
    title: payload.title,
    description: payload.description,
    duration: 2600,
    fill: "rgba(21, 29, 50, 0.96)",
    roundness: 14
  };

  if (payload.type === "success") {
    sileo.success(opts);
    return;
  }
  if (payload.type === "error") {
    sileo.error(opts);
    return;
  }
  if (payload.type === "warning") {
    sileo.warning(opts);
    return;
  }
  sileo.info(opts);
}

function notifyFromEvent(event) {
  notifyPayload(event?.detail || {});
}

try {
  renderToaster();
  window.__dplabSileoNotify = (payload) => {
    notifyPayload(payload);
    return true;
  };
  window.__dplabSileoReady = true;
  window.addEventListener(EVENT_NAME, notifyFromEvent);
} catch (error) {
  window.__dplabSileoNotify = null;
  window.__dplabSileoReady = false;
  console.error("No se pudo iniciar Sileo:", error);
}
