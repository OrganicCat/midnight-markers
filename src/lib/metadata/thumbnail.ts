import { ext } from '../ext';

export async function captureActiveTabThumbnail(_tabId: number): Promise<string | null> {
  try {
    const dataUrl = await ext.tabs.captureVisibleTab(ext.windows.WINDOW_ID_CURRENT, { format: 'jpeg', quality: 60 });
    if (dataUrl && dataUrl.length > 140000) {
      return await ext.tabs.captureVisibleTab(ext.windows.WINDOW_ID_CURRENT, { format: 'jpeg', quality: 30 });
    }
    return dataUrl ?? null;
  } catch {
    return null;
  }
}
