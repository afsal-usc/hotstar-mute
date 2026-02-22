(function () {
  "use strict";

  const AD_SELECTORS = [
    '[class*="ad-overlay"]',
    '[class*="ad-banner"]',
    '[class*="ad-container"]',
    '[class*="AdOverlay"]',
    '[class*="adOverlay"]',
    '[class*="ad-pod"]',
    '[class*="ad_overlay"]',
    '[class*="preroll"]',
    '[class*="midroll"]',
    '[data-ad]',
    '[class*="advertisement"]',
  ];

  const AD_TEXT_PATTERNS = [/^\s*Ad\s*$/, /^\s*Ad\s*\d/,  /Advertisement/i, /Skip\s*Ad/i];

  const POLL_INTERVAL = 500;
  const VIDEO_FIND_RETRY = 2000;
  const MAX_VIDEO_RETRIES = 30;

  const ENFORCE_INTERVAL = 100;

  let videoElement = null;
  let wasMutedByUser = false;
  let savedVolume = 1;
  let isMutedByExtension = false;
  let enforceTimerId = null;
  let observer = null;
  let pollTimerId = null;
  let isEnabled = true;

  function findVideoElement() {
    const videos = document.querySelectorAll("video");
    if (videos.length === 0) return null;

    for (const v of videos) {
      if (v.readyState > 0 || v.src || v.currentSrc) return v;
    }
    return videos[0];
  }

  function waitForVideo(retries = 0) {
    videoElement = findVideoElement();
    if (videoElement) {
      initVideoTracking();
      return;
    }
    if (retries < MAX_VIDEO_RETRIES) {
      setTimeout(() => waitForVideo(retries + 1), VIDEO_FIND_RETRY);
    }
  }

  function initVideoTracking() {
    videoElement.addEventListener("volumechange", () => {
      if (!isMutedByExtension) {
        wasMutedByUser = videoElement.muted;
        savedVolume = videoElement.volume;
      }
    });
    wasMutedByUser = videoElement.muted;
    savedVolume = videoElement.volume;
  }

  function enforceAllVideosMuted() {
    document.querySelectorAll("video").forEach((v) => {
      v.muted = true;
      v.volume = 0;
    });
  }

  function muteVideo() {
    if (!videoElement) videoElement = findVideoElement();
    if (!videoElement) return;

    if (!isMutedByExtension) {
      wasMutedByUser = videoElement.muted;
      savedVolume = videoElement.volume;
    }

    videoElement.muted = true;
    videoElement.volume = 0;
    isMutedByExtension = true;
    showIndicator(true);

    if (!enforceTimerId) {
      enforceTimerId = setInterval(enforceAllVideosMuted, ENFORCE_INTERVAL);
    }
  }

  function unmuteVideo() {
    if (!isMutedByExtension) return;

    if (enforceTimerId) {
      clearInterval(enforceTimerId);
      enforceTimerId = null;
    }

    isMutedByExtension = false;

    document.querySelectorAll("video").forEach((v) => {
      v.muted = wasMutedByUser;
      v.volume = savedVolume;
    });

    showIndicator(false);
  }

  let indicatorEl = null;

  function showIndicator(adPlaying) {
    if (!indicatorEl) {
      indicatorEl = document.createElement("div");
      indicatorEl.id = "hotstar-ad-muter-indicator";
      Object.assign(indicatorEl.style, {
        position: "fixed",
        top: "10px",
        right: "10px",
        zIndex: "999999",
        padding: "6px 14px",
        borderRadius: "20px",
        fontSize: "13px",
        fontWeight: "600",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#fff",
        pointerEvents: "none",
        transition: "opacity 0.3s, background 0.3s",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      });
      document.body.appendChild(indicatorEl);
    }

    if (adPlaying) {
      indicatorEl.textContent = "Ad Muted";
      indicatorEl.style.background = "rgba(220, 53, 69, 0.85)";
      indicatorEl.style.opacity = "1";
    } else {
      indicatorEl.textContent = "Live";
      indicatorEl.style.background = "rgba(40, 167, 69, 0.85)";
      indicatorEl.style.opacity = "1";
      setTimeout(() => {
        if (indicatorEl && !isMutedByExtension) {
          indicatorEl.style.opacity = "0";
        }
      }, 3000);
    }
  }

  function checkForAdElements() {
    for (const selector of AD_SELECTORS) {
      const el = document.querySelector(selector);
      if (el && el.offsetParent !== null) {
        return true;
      }
    }

    const playerContainer =
      document.querySelector('[class*="player"]') ||
      document.querySelector('[class*="Player"]') ||
      document.querySelector('[id*="player"]');

    if (playerContainer) {
      const walker = document.createTreeWalker(
        playerContainer,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      let node;
      while ((node = walker.nextNode())) {
        const text = node.textContent.trim();
        if (text.length > 0 && text.length < 20) {
          for (const pattern of AD_TEXT_PATTERNS) {
            if (pattern.test(text)) {
              const parent = node.parentElement;
              if (parent && parent.offsetParent !== null) {
                return true;
              }
            }
          }
        }
      }
    }

    return false;
  }

  let domAdDetected = false;

  function pollForAds() {
    if (!isEnabled) return;

    const adVisible = checkForAdElements();

    if (adVisible && !domAdDetected) {
      domAdDetected = true;
      chrome.runtime.sendMessage({ action: "adDetectedByDOM" }).catch(() => {});
    } else if (!adVisible && domAdDetected) {
      domAdDetected = false;
      chrome.runtime.sendMessage({ action: "adEndedByDOM" }).catch(() => {});
    }
  }

  function setupObserver() {
    const target = document.querySelector('[class*="player"]') ||
      document.querySelector('[class*="Player"]') ||
      document.querySelector('[id*="player"]') ||
      document.body;

    observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      for (const mutation of mutations) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          shouldCheck = true;
          break;
        }
        if (mutation.type === "attributes") {
          shouldCheck = true;
          break;
        }
      }
      if (shouldCheck) pollForAds();
    });

    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "data-ad", "data-ad-playing"],
    });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isEnabled && message.action !== "setEnabled") return;

    switch (message.action) {
      case "mute":
        muteVideo();
        break;
      case "unmute":
        unmuteVideo();
        break;
      case "setEnabled":
        isEnabled = message.enabled;
        if (!isEnabled && isMutedByExtension) {
          unmuteVideo();
        }
        break;
    }
  });

  function init() {
    chrome.storage.local.get({ enabled: true }, (result) => {
      isEnabled = result.enabled;
    });

    waitForVideo();
    setupObserver();
    pollTimerId = setInterval(pollForAds, POLL_INTERVAL);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
