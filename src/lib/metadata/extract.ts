export type ExtractedMetadata = {
  title: string;
  description: string | null;
  faviconUrl: string | null;
  ogImageUrl: string | null;
  excerpt: string | null;
};

export function extractFromDocument(): ExtractedMetadata {
  const meta = (selector: string) =>
    document.querySelector(selector)?.getAttribute('content') ?? null;

  const linkHref = (selector: string) => {
    const el = document.querySelector<HTMLLinkElement>(selector);
    return el ? new URL(el.href, location.href).toString() : null;
  };

  const title = document.title?.trim() || location.hostname;
  const description = meta('meta[property="og:description"]') ?? meta('meta[name="description"]');
  const ogImageUrl = meta('meta[property="og:image"]');
  const faviconUrl =
    linkHref('link[rel="icon"]') ??
    linkHref('link[rel="shortcut icon"]') ??
    `${location.origin}/favicon.ico`;

  const text = (document.body.innerText || '').replace(/\s+/g, ' ').trim();
  const excerpt = text ? text.slice(0, 500) : null;

  return { title, description, faviconUrl, ogImageUrl, excerpt };
}
