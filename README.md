![Hotstar Ad Muter](icons/icon128.png?raw=true)

# Hotstar Ad Muter

This small browser extension **automatically mutes ads** during live sport streams on Hotstar (like IPL cricket). It works by detecting when Hotstar plays an ad—either by watching their ad-tracking requests or by spotting ad overlays on the page—and mutes the video until the match is back on.

**Your ears get a break.** No more sudden loud ads. When the ad ends, your volume comes back exactly as you had it.

You can turn the extension on or off anytime from the popup. Made for personal use—feel free to fork the repo and tweak it for your own needs.

---

## Installation

**Get the files on your computer**

[Click here to download the zip file](https://github.com/afsal-usc/hotstar-mute/archive/refs/heads/main.zip). Extract it after downloading.

### Google Chrome

1. Open **Chrome** and go to `chrome://extensions/`
2. Turn on **Developer mode** (top-right corner)
3. Click **Load unpacked**
4. Select the extracted folder (e.g. `hotstar-mute-main`—the one that contains `manifest.json`)
5. Done. Ads should now be muted during live streams on Hotstar.

**Other Chromium browsers** (Edge, Brave, Opera): Same steps, but use `edge://extensions/`, `brave://extensions/`, or the equivalent for your browser.

---

## Customize

### Mute all ads (default)

The extension mutes **all** ads by default. This is controlled by `MUTE_ALL_ADS` in `background.js`—it’s set to `true`.

### Finding ad identifiers

If you want to change the behavior (for example, to mute only certain ads), you can find ad identifiers like this:

1. Open Chrome and go to `chrome://extensions/`
2. Find **Hotstar Ad Muter** and click **Details**
3. Under **Inspect views**, click the link to open the extension’s console
4. While watching a live stream, look for logs like `Ad detected:` followed by the ad name
5. Use those names to customize the extension (you’d need to add filtering logic in `background.js`)

You can also open DevTools (F12) → **Network** tab, filter for `bifrost-api.hotstar.com`, and check the `adName` parameter in the request URLs when an ad plays.

---

## Caveats

- **Slightly late unmute:** Sometimes broadcasters cut an ad short. The extension may keep the tab muted for a few extra seconds before unmuting.
- **Hotstar changes:** If Hotstar changes their tracking URLs or ad identifiers, the extension may stop working until it’s updated.

---

## License

MIT © 2025
