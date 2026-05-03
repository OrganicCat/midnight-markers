export async function captureActiveTabThumbnail(_tabId: number): Promise<string | null> {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'jpeg', quality: 60 });
    if (dataUrl && dataUrl.length > 140000) {
      return await chrome.tabs.captureVisibleTab({ format: 'jpeg', quality: 30 });
    }
    return dataUrl ?? null;
  } catch {
    return null;
  }
}
