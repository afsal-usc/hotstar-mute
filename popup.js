const enableToggle = document.getElementById("enableToggle");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const adNameEl = document.getElementById("adName");

function updateUI(enabled, adState) {
  enableToggle.checked = enabled;

  if (!enabled) {
    statusDot.className = "status-dot disabled";
    statusText.textContent = "Disabled";
    adNameEl.textContent = "";
    return;
  }

  if (adState?.isAdPlaying) {
    statusDot.className = "status-dot ad";
    statusText.textContent = "Ad detected — muted";
    adNameEl.textContent = adState.adName
      ? `Ad: ${adState.adName}`
      : "";
  } else {
    statusDot.className = "status-dot watching";
    statusText.textContent = "Watching for ads...";
    adNameEl.textContent = "";
  }
}

function loadState() {
  chrome.storage.local.get({ enabled: true, adState: {} }, (result) => {
    updateUI(result.enabled, result.adState);
  });
}

enableToggle.addEventListener("change", () => {
  const enabled = enableToggle.checked;
  chrome.storage.local.set({ enabled });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "setEnabled",
        enabled,
      }).catch(() => {});
    }
  });

  loadState();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.adState || changes.enabled) {
    loadState();
  }
});

loadState();

setInterval(loadState, 1000);
