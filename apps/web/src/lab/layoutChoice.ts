// Which Lab a phone gets. Phones open the mobile Lab unless "Desktop Lab" was picked in this browser.
export const LAYOUT_KEY = "mybrute.lab.layout";

export function prefersDesktopLab(): boolean {
  try {
    return localStorage.getItem(LAYOUT_KEY) === "desktop";
  } catch {
    return false;
  }
}

/** "desktop" stops phones being sent to the mobile Lab; null goes back to the default. */
export function setLabLayout(choice: "desktop" | null): void {
  try {
    if (choice) localStorage.setItem(LAYOUT_KEY, choice);
    else localStorage.removeItem(LAYOUT_KEY);
  } catch {
    /* without storage the default applies */
  }
}

// The mobile Brute screen's layout: folding sections (default) or the kit list and level-ups pinned on screen.
const PINNED_KEY = "mybrute.lab.mobilePinned";

export function readPinned(): boolean {
  try {
    return localStorage.getItem(PINNED_KEY) === "1";
  } catch {
    return false;
  }
}

export function savePinned(on: boolean): void {
  try {
    if (on) localStorage.setItem(PINNED_KEY, "1");
    else localStorage.removeItem(PINNED_KEY);
  } catch {
    /* still applies for this visit */
  }
}
