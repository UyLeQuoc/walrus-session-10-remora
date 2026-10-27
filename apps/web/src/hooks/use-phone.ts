import { useEffect, useState } from "react";

/** The shell's phone breakpoint (ADR-0069): at 720px and below, one pane at a time. */
export const PHONE_QUERY = "(max-width: 720px)";

function matches(): boolean {
  return typeof matchMedia === "function" && Boolean(matchMedia(PHONE_QUERY)?.matches);
}

/** True at 720px and below, following resizes. */
export function usePhone(): boolean {
  const [phone, setPhone] = useState(matches);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const mql = matchMedia(PHONE_QUERY);
    if (!mql?.addEventListener) return;
    const onChange = () => setPhone(matches());
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return phone;
}
