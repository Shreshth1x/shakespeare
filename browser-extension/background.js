const BRIDGE_URL = "http://127.0.0.1:8791/v1/browser-context";
const NATIVE_HOST = "com.shakespeare.promptcompiler";
const MESSAGE_TYPE = "shakespeare:browser-context";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== MESSAGE_TYPE) {
    return false;
  }

  postContext(message.payload)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Could not send browser context."
      });
    });

  return true;
});

async function postContext(payload) {
  const nativeResult = await postNative(payload);
  if (nativeResult.ok) {
    return nativeResult;
  }

  const localhostResult = await postLocalhost(payload);
  if (localhostResult.ok) {
    return {
      ...localhostResult,
      native_error: nativeResult.error
    };
  }

  return {
    ok: false,
    transport: "none",
    error: localhostResult.error || nativeResult.error || "No Shakespeare browser bridge is available."
  };
}

function postNative(payload) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendNativeMessage(
        NATIVE_HOST,
        {
          type: "browser_context",
          payload
        },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({
              ok: false,
              transport: "native",
              error: chrome.runtime.lastError.message
            });
            return;
          }

          if (response?.ok) {
            resolve({
              ok: true,
              transport: "native"
            });
            return;
          }

          resolve({
            ok: false,
            transport: "native",
            error: response?.error || "Native host rejected browser context."
          });
        }
      );
    } catch (error) {
      resolve({
        ok: false,
        transport: "native",
        error: error instanceof Error ? error.message : "Native messaging failed."
      });
    }
  });
}

async function postLocalhost(payload) {
  try {
    const response = await fetch(BRIDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      return {
        ok: false,
        transport: "localhost",
        error: `Local bridge returned ${response.status}.`
      };
    }

    return {
      ok: true,
      transport: "localhost"
    };
  } catch (error) {
    return {
      ok: false,
      transport: "localhost",
      error: error instanceof Error ? error.message : "Local bridge unavailable."
    };
  }
}
