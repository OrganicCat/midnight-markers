import { bookmarks } from '$lib/storage/bookmarks';
import { collections as colStore } from '$lib/storage/collections';

export type ChromeBookmarkNode = {
  id: string;
  title: string;
  url?: string;
  children?: ChromeBookmarkNode[];
};

export type FlatNativeBookmark = {
  title: string;
  url: string;
  folderPath: string[];   // sequence of folder names from root child to leaf parent
};

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

export function flattenBookmarkTree(roots: ChromeBookmarkNode[]): FlatNativeBookmark[] {
  const out: FlatNativeBookmark[] = [];
  // The Chrome tree root is always one synthetic node with empty title and children
  // like "Bookmarks bar" and "Other bookmarks". We skip the root node itself.
  const walk = (node: ChromeBookmarkNode, path: string[]): void => {
    if (node.url) {
      out.push({
        title: node.title.trim() || domainOf(node.url),
        url: node.url,
        folderPath: path,
      });
      return;
    }
    if (node.children) {
      const nextPath = node.title ? [...path, node.title] : path;
      for (const child of node.children) walk(child, nextPath);
    }
  };

  for (const root of roots) walk(root, []);
  return out;
}

export type ImportProgress = { total: number; done: number };

export async function importNativeBookmarks(
  onProgress?: (p: ImportProgress) => void,
): Promise<{ imported: number; skipped: number }> {
  const tree = await chrome.bookmarks.getTree();
  const flat = flattenBookmarkTree(tree as ChromeBookmarkNode[]);

  const folderToCollection = new Map<string, string>(); // joined path -> collectionId
  const existingCollections = await colStore.list();
  for (const c of existingCollections) folderToCollection.set(c.name.toLowerCase(), c.id);

  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < flat.length; i++) {
    const item = flat[i]!;
    onProgress?.({ total: flat.length, done: i });
    try {
      // Map deepest folder name to a collection (create if needed).
      const leafFolder = item.folderPath[item.folderPath.length - 1];
      let collectionId: string | null = null;
      if (leafFolder) {
        const key = leafFolder.toLowerCase();
        let id = folderToCollection.get(key);
        if (!id) {
          const c = await colStore.create({ name: leafFolder });
          id = c.id;
          folderToCollection.set(key, id);
        }
        collectionId = id;
      }
      await bookmarks.create({
        url: item.url,
        title: item.title,
        originalTitle: item.title,
        ...(collectionId ? { collectionId } : {}),
      });
      imported++;
    } catch {
      skipped++;
    }
  }
  onProgress?.({ total: flat.length, done: flat.length });
  return { imported, skipped };
}
