import { Link } from "react-router";
import { useMe } from "@/features/me/use-me";

export function MemoryStrip() {
  const { me, memories } = useMe();
  const stored = memories.filter((m) => m.status === "stored").length;
  const mode =
    me?.mode === "owned" ? "you own this" : me?.mode === "guest" ? "guest" : "no memory yet";
  const remembering =
    me?.mode === "anonymous" || !me ? "" : me.memoryEnabled === false ? "paused" : "remembering";
  const count =
    me && me.mode !== "anonymous"
      ? `${stored} of ${memories.length} on Walrus`
      : "Nothing on Walrus yet";

  return (
    <Link to="/me" className="px-3 text-center text-xs text-muted-foreground hover:text-foreground">
      {[count, mode, remembering].filter(Boolean).join(" · ")}
    </Link>
  );
}
