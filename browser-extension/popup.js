document.getElementById("send")?.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        document.dispatchEvent(new Event("selectionchange"));
      }
    });
    document.getElementById("status").textContent = "Sent";
  } catch {
    document.getElementById("status").textContent = "Open a supported page first.";
  }
});
