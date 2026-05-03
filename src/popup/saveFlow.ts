import { bookmarks } from '$lib/storage/bookmarks';
import type { ExtractedMetadata } from '$lib/metadata/extract';

export async function performSave(args: {
  url: string;
  extracted: ExtractedMetadata;
}): Promise<string> {
  const title = args.extracted.title?.trim() || args.url;
  const b = await bookmarks.create({
    url: args.url,
    title,
    originalTitle: title,
    description: args.extracted.description,
    excerpt: args.extracted.excerpt,
    faviconUrl: args.extracted.faviconUrl,
    thumbnailUrl: args.extracted.ogImageUrl,
  });
  return b.id;
}
