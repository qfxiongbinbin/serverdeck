// author: BrianXiong
// time: 2026/04/08/12:06:00
export function isSettingsWindowView() {
  if (typeof window === "undefined") {
    return false;
  }

  return new URLSearchParams(window.location.search).get("view") === "settings";
}

// author: BrianXiong
// time: 2026/04/08/12:06:00
export async function openSettingsWindow(title: string) {
  if (typeof window === "undefined" || !window.__TAURI_INTERNALS__) {
    return false;
  }

  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const existingWindow = await WebviewWindow.getByLabel("settings");
  if (existingWindow) {
    await existingWindow.show();
    await existingWindow.setFocus();
    return true;
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("view", "settings");
  nextUrl.hash = "";

  const settingsWindow = new WebviewWindow("settings", {
    title,
    url: `${nextUrl.pathname}${nextUrl.search}`,
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 720,
    center: true,
    resizable: true,
    focus: true
  });

  settingsWindow.once("tauri://created", async () => {
    await settingsWindow.setFocus();
  });

  return true;
}
