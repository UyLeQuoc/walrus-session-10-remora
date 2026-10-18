import { useEffect } from "react";
import { type PageMeta, pageHead } from "@/hooks/page-meta";

function setMeta(attribute: "name" | "property", key: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.setAttribute("content", content);
}

function setCanonical(href: string | null): void {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) {
    existing?.remove();
    return;
  }
  const element = existing ?? document.createElement("link");
  element.setAttribute("rel", "canonical");
  element.setAttribute("href", href);
  if (!existing) document.head.append(element);
}

export function usePageMeta({ title, description, path, index }: PageMeta): void {
  useEffect(() => {
    const head = pageHead({ title, description, path, index });
    document.title = head.title;
    setMeta("name", "description", head.description);
    setMeta("name", "robots", head.robots);
    setMeta("property", "og:title", head.title);
    setMeta("property", "og:description", head.description);
    setMeta("name", "twitter:title", head.title);
    setMeta("name", "twitter:description", head.description);
    setCanonical(head.canonical);
    if (head.canonical) setMeta("property", "og:url", head.canonical);
  }, [title, description, path, index]);
}
