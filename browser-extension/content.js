const BRIDGE_URL = "http://127.0.0.1:8791/v1/browser-context";
const REPLACEMENT_URL = "http://127.0.0.1:8791/v1/browser-replacement";
const MESSAGE_TYPE = "shakespeare:browser-context";
const MAX_VISIBLE_TEXT = 6000;
const MAX_FIELD_TEXT = 24000;
const REPLACEMENT_POLL_MS = 450;

let pendingTimer = null;
let replacementPollTimer = null;

function scheduleSend() {
  clearTimeout(pendingTimer);
  pendingTimer = setTimeout(sendContext, 350);
}

async function sendContext() {
  const payload = collectContext();
  if (!payload.visibleText && !payload.selectedText && !payload.focusedText) return;

  try {
    await postContext(payload);
  } catch {
    // The desktop app may not be running. Stay silent in the page.
  }
}

async function postContext(payload) {
  const backgroundResult = await postViaBackground(payload);
  if (backgroundResult?.ok) {
    return;
  }

  await fetch(BRIDGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

function postViaBackground(payload) {
  return new Promise((resolve) => {
    if (!globalThis.chrome?.runtime?.sendMessage) {
      resolve(null);
      return;
    }

    chrome.runtime.sendMessage(
      {
        type: MESSAGE_TYPE,
        payload
      },
      (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(response);
      }
    );
  });
}

function collectContext() {
  const activeElement = document.activeElement;
  const focusedText = getFocusedText(activeElement);
  return {
    url: location.href,
    title: document.title,
    hostname: location.hostname,
    selectedText: getSelectionText(),
    focusedText: focusedText.text,
    focusedTextTruncated: focusedText.truncated,
    visibleText: getVisibleText(),
    updatedAt: new Date().toISOString(),
    source: "browser_extension"
  };
}

function getSelectionText() {
  return truncate(String(window.getSelection?.() ?? "").trim(), MAX_FIELD_TEXT);
}

function getFocusedText(element) {
  const editable = getFocusedEditable(element);
  if (!editable) return { text: "", truncated: false };

  if (editable instanceof HTMLTextAreaElement || editable instanceof HTMLInputElement) {
    return truncateWithMeta(editable.value || "", MAX_FIELD_TEXT);
  }

  if (editable.isContentEditable) {
    return truncateWithMeta(editable.textContent || "", MAX_FIELD_TEXT);
  }

  return { text: "", truncated: false };
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
  return truncateWithMeta(value, maxLength).text;
}

function truncateWithMeta(value, maxLength) {
  const trimmed = String(value ?? "").trim();
  const truncated = trimmed.length > maxLength;
  if (!truncated) return { text: trimmed, truncated: false };
  return { text: `${trimmed.slice(0, maxLength - 1)}…`, truncated: true };
}

function getFocusedEditable(element) {
  if (!element) return null;

  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    return isRewriteableInput(element) ? element : null;
  }

  if (element.isContentEditable) {
    return element;
  }

  const closestEditable = element.closest?.("[contenteditable='true'], textarea, input");
  if (closestEditable instanceof HTMLTextAreaElement || closestEditable instanceof HTMLInputElement) {
    return isRewriteableInput(closestEditable) ? closestEditable : null;
  }
  if (closestEditable?.isContentEditable) {
    return closestEditable;
  }

  return null;
}

function isRewriteableInput(element) {
  if (element.disabled || element.readOnly) return false;
  const type = (element.getAttribute("type") || "text").toLowerCase();
  return !["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit", "password"].includes(type);
}

function scheduleReplacementPoll(delay = REPLACEMENT_POLL_MS) {
  if (replacementPollTimer || document.visibilityState !== "visible" || !getFocusedEditable(document.activeElement)) return;
  replacementPollTimer = setTimeout(() => {
    replacementPollTimer = null;
    void pollReplacement();
  }, delay);
}

async function pollReplacement() {
  if (document.visibilityState !== "visible" || !getFocusedEditable(document.activeElement)) return;

  try {
    const response = await fetch(`${REPLACEMENT_URL}?url=${encodeURIComponent(location.href)}`);
    if (response.status === 200) {
      const command = await response.json();
      const ok = replaceFocusedText(command.text);
      await completeReplacement(command.id, ok);
      if (ok) scheduleSend();
      return;
    }
  } catch {
    // The app may not be running. Keep the page quiet.
  }

  scheduleReplacementPoll();
}

async function completeReplacement(id, ok) {
  try {
    await fetch(`${REPLACEMENT_URL}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ok })
    });
  } catch {
    // Best-effort acknowledgement only.
  }
}

function replaceFocusedText(text) {
  const editable = getFocusedEditable(document.activeElement);
  if (!editable) return false;

  if (editable instanceof HTMLTextAreaElement || editable instanceof HTMLInputElement) {
    setNativeValue(editable, text);
    moveCaretToEnd(editable, text);
    dispatchEditableEvents(editable, text);
    return true;
  }

  if (editable.isContentEditable) {
    editable.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editable);
    selection?.removeAllRanges();
    selection?.addRange(range);
    const inserted = document.execCommand?.("insertText", false, text);
    if (!inserted) {
      editable.textContent = text;
    }
    dispatchEditableEvents(editable, text);
    return true;
  }

  return false;
}

function setNativeValue(element, value) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  if (descriptor?.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
}

function moveCaretToEnd(element, text) {
  try {
    element.focus();
    element.setSelectionRange(text.length, text.length);
  } catch {
    element.focus();
  }
}

function dispatchEditableEvents(element, text) {
  try {
    element.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertReplacementText",
        data: text
      })
    );
  } catch {
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

document.addEventListener("selectionchange", scheduleSend, { passive: true });
document.addEventListener("focusin", () => {
  scheduleSend();
  scheduleReplacementPoll(100);
}, { passive: true });
document.addEventListener("keyup", () => {
  scheduleSend();
  scheduleReplacementPoll();
}, { passive: true });
document.addEventListener("input", () => {
  scheduleSend();
  scheduleReplacementPoll();
}, { passive: true });
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    scheduleSend();
    scheduleReplacementPoll(100);
  }
});

scheduleSend();
scheduleReplacementPoll(100);
