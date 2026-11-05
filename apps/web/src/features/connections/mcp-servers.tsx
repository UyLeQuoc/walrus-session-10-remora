/**
 * ADR-0143 (D10): the other direction from tokens: a remora reads tools from an MCP server. Only the
 * tools the server marks read-only are offered, the owner ticks the ones it may use, and what they
 * return is data, never instructions. A token is stored encrypted and never shown again.
 */

import type { McpServerView } from "@remora/schema";
import { Plug, Plus } from "lucide-react";
import { useState } from "react";
import { ConfirmAction } from "@/components/app/confirm-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Problem } from "@/components/visual";
import { api } from "@/features/remoras/api";
import { useLoad } from "@/features/remoras/hooks";
import { kindName } from "@/lib/kind";
import { useMcpServers } from "./use-mcp-servers";

function ServerCard({
  s,
  busy,
  onToggle,
  onRemove,
}: {
  s: McpServerView;
  busy: boolean;
  onToggle: (tool: string, on: boolean) => void;
  onRemove: () => Promise<void>;
}) {
  return (
    <Card data-testid="mcp-server" className="gap-3 py-3">
      <CardHeader className="px-4">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          <Plug className="size-4 text-ob-muted" aria-hidden />
          <span className="min-w-0 truncate">{s.name}</span>
          <code className="min-w-0 truncate text-xs font-normal text-ob-muted">{s.host}</code>
          {s.hasToken ? <Badge variant="outline">token set</Badge> : null}
          <span className="ml-auto flex items-center gap-2">
            {busy ? <Spinner /> : null}
            <ConfirmAction
              trigger={
                <Button type="button" variant="ghost" size="sm">
                  Remove
                </Button>
              }
              title={`Remove ${s.name}?`}
              description="The remora stops calling it. Answers it already gave keep their citations."
              confirmLabel="Remove"
              tone="danger"
              onConfirm={onRemove}
            />
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 px-4">
        <div className="ob-group" data-surface="subtle">
          {s.offered.map((t) => (
            <div key={t.name} className="ob-row items-start" data-size="compact">
              <Checkbox
                id={`mcp-${s.id}-${t.name}`}
                checked={s.tools.includes(t.name)}
                disabled={busy}
                onCheckedChange={(v) => onToggle(t.name, v === true)}
                aria-label={`Let it use ${t.name}`}
                className="mt-0.5"
              />
              <label htmlFor={`mcp-${s.id}-${t.name}`} className="ob-row-content cursor-pointer">
                <span className="ob-row-title text-md">
                  <code>{t.name}</code> <span className="text-ob-muted">read-only</span>
                </span>
                <span className="ob-row-description">{t.description || t.title}</span>
              </label>
            </div>
          ))}
        </div>
        {s.hidden ? (
          <p className="text-xs text-ob-muted">
            {s.hidden} more tool{s.hidden === 1 ? " isn't" : "s aren't"} marked read-only, so{" "}
            {s.hidden === 1 ? "it's" : "they're"} not offered.
          </p>
        ) : null}
        <p className="text-xs text-ob-muted">
          Its answers cite <code>mcp:{s.host}/&lt;tool&gt;</code> in Why?.
        </p>
      </CardContent>
    </Card>
  );
}

export function McpServers() {
  const remoras = useLoad(() => api.remoras(), []);
  const usable = (remoras.data?.remoras ?? []).filter(
    (r) => r.status !== "retired" && r.status !== "creating",
  );
  const [picked, setPicked] = useState("");
  const remoraId = picked || usable[0]?.id || "";
  const m = useMcpServers(remoraId);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  if (!usable.length) return null;
  return (
    <div className="flex max-w-2xl flex-col gap-4" data-testid="mcp-servers">
      <p className="text-md text-ob-muted">
        Give a remora read-only tools from any MCP server (Streamable HTTP, https). Only the tools
        the server marks read-only can be ticked, it calls 3 at most per answer, and what they
        return is data, never instructions.
      </p>
      <Field>
        <FieldLabel htmlFor="mcp-server-remora">Remora</FieldLabel>
        <NativeSelect
          id="mcp-server-remora"
          value={remoraId}
          onChange={(e) => setPicked(e.target.value)}
        >
          {usable.map((r) => (
            <NativeSelectOption key={r.id} value={r.id}>
              {r.name} · {kindName(r.template)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      {m.loadError ? (
        <Problem
          title="Can't load its MCP servers."
          detail={m.loadError}
          onRetry={() => void m.refresh()}
        />
      ) : null}
      {m.servers.map((s) => (
        <ServerCard
          key={s.id}
          s={s}
          busy={m.busy === `tick:${s.id}`}
          onToggle={(tool, on) => void m.toggle(s, tool, on)}
          onRemove={() => m.remove(s)}
        />
      ))}
      <form
        className="ob-card gap-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void m.add({ url, name, token }).then((ok) => {
            if (!ok) return;
            setUrl("");
            setName("");
            setToken("");
          });
        }}
      >
        <Field>
          <FieldLabel htmlFor="mcp-server-url">Server URL</FieldLabel>
          <Input
            id="mcp-server-url"
            placeholder="https://mcp.context7.com/mcp"
            value={url}
            maxLength={500}
            onChange={(e) => setUrl(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="mcp-server-name">Name (optional)</FieldLabel>
          <Input
            id="mcp-server-name"
            placeholder="docs"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
          />
          <FieldDescription>What the remora calls it. Default: from the host.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="mcp-server-token">Token (optional)</FieldLabel>
          <Input
            id="mcp-server-token"
            type="password"
            autoComplete="off"
            value={token}
            maxLength={4096}
            onChange={(e) => setToken(e.target.value)}
          />
          <FieldDescription>
            Sent as a bearer token. Stored encrypted and never shown again.
          </FieldDescription>
        </Field>
        <div>
          <Button type="submit" disabled={!url.trim() || m.busy === "add"}>
            {m.busy === "add" ? <Spinner /> : <Plus />} Connect
          </Button>
        </div>
      </form>
      {m.error ? (
        <p className="text-md text-ob-danger-text" role="alert">
          {m.error}
        </p>
      ) : null}
    </div>
  );
}
