const AD_TRACKING_URL = "bifrost-api.hotstar.com/v1/events/track/ct_impression";

const MUTE_ALL_ADS = true;

const AD_DURATIONS = {
  "10": 10000,
  "15": 15000,
  "20": 20000,
  "30": 30000,
  "60": 60000,
};
const DEFAULT_AD_DURATION = 35000;

const UNMUTE_BUFFER = 2000;

let adState = {
  isAdPlaying: false,
  currentAdName: null,
  unmuteTimerId: null,
};

function guessAdDuration(adName) {
  if (!adName) return DEFAULT_AD_DURATION;

  const match = adName.match(/(\d+)[sS](?:ec)?/);
  if (match) {
    const seconds = parseInt(match[1], 10);
    if (seconds >= 5 && seconds <= 120) return seconds * 1000;
  }

  for (const [key, duration] of Object.entries(AD_DURATIONS)) {
    if (adName.includes(key)) return duration;
  }

  return DEFAULT_AD_DURATION;
}

function extractAdName(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get("adName") || urlObj.searchParams.get("ad_name") || null;
  } catch {
    return null;
  }
}

async function isEnabled() {
  const result = await chrome.storage.local.get({ enabled: true });
  return result.enabled;
}

function notifyContentScript(tabId, action, data = {}) {
  chrome.tabs.sendMessage(tabId, { action, ...data }).catch(() => {});
}

function setTabMuted(tabId, muted) {
  chrome.tabs.update(tabId, { muted }).catch(() => {});
}

function handleAdDetected(tabId, adName) {
  if (adState.unmuteTimerId) {
    clearTimeout(adState.unmuteTimerId);
    adState.unmuteTimerId = null;
  }

  adState.isAdPlaying = true;
  adState.currentAdName = adName;
  adState.tabId = tabId;

  console.log(`Ad detected: ${adName || "unknown"}`);

  setTabMuted(tabId, true);
  notifyContentScript(tabId, "mute", { adName });

  chrome.storage.local.set({ adState: { isAdPlaying: true, adName } });

  const duration = guessAdDuration(adName);
  console.log(`Estimated ad duration: ${duration}ms`);

  adState.unmuteTimerId = setTimeout(() => {
    handleAdEnded(tabId);
  }, duration + UNMUTE_BUFFER);
}

function handleAdEnded(tabId) {
  if (adState.unmuteTimerId) {
    clearTimeout(adState.unmuteTimerId);
    adState.unmuteTimerId = null;
  }

  adState.isAdPlaying = false;
  adState.currentAdName = null;

  console.log("Ad ended, unmuting");

  setTabMuted(tabId, false);
  notifyContentScript(tabId, "unmute");

  chrome.storage.local.set({ adState: { isAdPlaying: false, adName: null } });
}

chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    if (!(await isEnabled())) return;

    if (details.url.includes(AD_TRACKING_URL)) {
      const adName = extractAdName(details.url);

      if (MUTE_ALL_ADS || adName) {
        handleAdDetected(details.tabId, adName);
      }
    }
  },
  { urls: ["*://bifrost-api.hotstar.com/*"] }
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getAdState") {
    sendResponse({ ...adState, unmuteTimerId: undefined });
    return true;
  }

  if (message.action === "adDetectedByDOM") {
    if (!adState.isAdPlaying && sender.tab) {
      handleAdDetected(sender.tab.id, message.adName || "DOM_detected");
    }
    return true;
  }

  if (message.action === "adEndedByDOM") {
    if (adState.isAdPlaying && sender.tab) {
      handleAdEnded(sender.tab.id);
    }
    return true;
  }
});

chrome.storage.local.set({
  adState: { isAdPlaying: false, adName: null },
});
