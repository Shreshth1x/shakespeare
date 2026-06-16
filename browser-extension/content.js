const BRIDGE_URL = "http://127.0.0.1:8791/v1/browser-context";
const MAX_VISIBLE_TEXT = 6000;
const MAX_FIELD_TEXT = 3000;

let pendingTimer = null;

function scheduleSend() {
  clearTimeout(pendingTimer);
  pendingTimer = setTimeout(sendContext, 350);
}

async function sendContext() {
  const payload = collectContext();
  if (!payload.visibleText && !payload.selectedText && !payload.focusedText) return;

  try {
    await fetch(BRIDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch {
    // The desktop app may not be running. Stay silent in the page.
  }
}

function collectContext() {
  const activeElement = document.activeElement;
  return {
    url: location.href,
    title: document.title,
    hostname: location.hostname,
    selectedText: getSelectionText(),
    focusedText: getFocusedText(activeElement),
    visibleText: getVisibleText(),
    updatedAt: new Date().toISOString(),
    source: "browser_extension"
  };
}

function getSelectionText() {
  return truncate(String(window.getSelection?.() ?? "").trim(), MAX_FIELD_TEXT);
}

function getFocusedText(element) {
  if (!element) return "";

  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    return truncate(element.value || "", MAX_FIELD_TEXT);
  }

  if (element.isContentEditable) {
    return truncate(element.textContent || "", MAX_FIELD_TEXT);
  }

  const closestEditable = element.closest?.("[contenteditable='true'], textarea, input");
  if (closestEditable instanceof HTMLTextAreaElement || closestEditable instanceof HTMLInputElement) {
    return truncate(closestEditable.value || "", MAX_FIELD_TEXT);
  }
  if (closestEditable?.isContentEditable) {
    return truncate(closestEditable.textContent || "", MAX_FIELD_TEXT);
  }

  return "";
}

function getVisibleText() {
  const main =
    document.querySelector("main") ||
    document.querySelector("[role='main']") ||
    document.querySelector("article") ||
    document.body;

  return truncate((main?.innerText || document.body?.innerText || "").replace(/\s+\n/g, "\n").replace(/[ \t]+/g, " "), MAX_VISIBLE_TEXT);
}

function truncate(value, maxLength) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

document.addEventListener("selectionchange", scheduleSend, { passive: true });
document.addEventListener("focusin", scheduleSend, { passive: true });
document.addEventListener("keyup", scheduleSend, { passive: true });
document.addEventListener("input", scheduleSend, { passive: true });
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") scheduleSend();
});

scheduleSend();
