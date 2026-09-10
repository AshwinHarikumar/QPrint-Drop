import { useEffect } from 'react';

type SeoProps = {
  title: string;
  description: string;
  canonicalPath: string;
  noindex?: boolean;
  imagePath?: string;
};

function ensureMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
  if (!element) {
    element = document.createElement(selector.startsWith('link') ? 'link' : 'meta');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element?.setAttribute(key, value);
  });
}

export default function Seo({
  title,
  description,
  canonicalPath,
  noindex = false,
  imagePath = '/og-image.svg',
}: SeoProps) {
  useEffect(() => {
    const origin = window.location.origin;
    const canonicalUrl = new URL(canonicalPath, origin).toString();
    const robots = noindex ? 'noindex,nofollow,max-image-preview:large' : 'index,follow,max-image-preview:large';

    document.title = title;

    ensureMeta('meta[name="description"]', { name: 'description', content: description });
    ensureMeta('meta[name="robots"]', { name: 'robots', content: robots });
    ensureMeta('meta[property="og:title"]', { property: 'og:title', content: title });
    ensureMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    ensureMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    ensureMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
    ensureMeta('meta[property="og:image"]', { property: 'og:image', content: new URL(imagePath, origin).toString() });
    ensureMeta('meta[property="og:image:alt"]', { property: 'og:image:alt', content: 'QPrint Drop preview banner' });
    ensureMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'QPrint Drop' });
    ensureMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
    ensureMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    ensureMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    ensureMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: new URL(imagePath, origin).toString() });
    ensureMeta('meta[name="twitter:url"]', { name: 'twitter:url', content: canonicalUrl });
    ensureMeta('link[rel="canonical"]', { rel: 'canonical', href: canonicalUrl });
  }, [canonicalPath, description, imagePath, noindex, title]);

  return null;
}