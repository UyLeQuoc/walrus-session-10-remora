// ADR-0099/0100: the deployed site. remora.vercel.app is someone else's (found Nov 4, ADR-0105).
export const SITE_URL = "https://getremora.vercel.app";

export type PageMeta = {
  title: string;
  description: string;
  path: string;
  index: boolean;
};

export type PageHead = {
  title: string;
  description: string;
  robots: string;
  canonical: string | null;
};

export function pageHead(meta: PageMeta): PageHead {
  return {
    title: meta.title,
    description: meta.description,
    robots: meta.index ? "index, follow" : "noindex, nofollow",
    canonical: meta.index ? new URL(meta.path, SITE_URL).toString() : null,
  };
}
