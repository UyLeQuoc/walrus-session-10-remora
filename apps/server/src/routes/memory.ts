import {
  IMPORT_CHANNEL,
  IMPORT_FACT_LIMIT,
  IMPORT_TEXT_LIMIT,
  IMPORT_TYPES,
} from "@remora/core/import-facts";
import { generateText } from "ai";
import { Hono } from "hono";
import { z } from "zod";
import { dropHidden } from "../chat/citations.ts";
import { readWebMessages } from "../chat/history.ts";
import { checkRate, noteCommand, noteModelCall } from "../chat/ratelimit.ts";
import { resolveStoredCitations } from "../chat/resolve-citations.ts";
import { PAGE_SIZE } from "../chat/transcript.ts";
import { model } from "../context.ts";
import { setMemoryEnabled } from "../identity/memory-flag.ts";
import { hiddenBlobs, portFor } from "../identity/persons.ts";
import { memoryChanges } from "../memory/changes.ts";
import { memoriesForChat } from "../memory/chat-memories.ts";
import { findImportFacts, keepImportedFacts } from "../memory/import.ts";
import { rememberFact } from "../memory/remember-fact.ts";
import { usageFor } from "../memory/usage-person.ts";
import { writeStatus } from "../memory/write-status.ts";
import { mePerson } from "./chat.ts";

const CHANNEL = "web";

const rememberBody = z.object({
  type: z.string(),
  text: z.string(),
  replaces: z.string().optional(),
});

const memoryBody = z.object({
  enabled: z.boolean(),
});

const idParam = z.uuid();

const importPreviewBody = z.object({ text: z.string().trim().min(10).max(IMPORT_TEXT_LIMIT) });

const importBody = z.object({
  facts: z
    .array(z.object({ type: z.enum(IMPORT_TYPES), text: z.string().trim().min(3).max(300) }))
    .min(1)
    .max(IMPORT_FACT_LIMIT),
});

export const memoryRoutes = new Hono()
  .post("/api/me/import/preview", async (c) => {
    const person = await mePerson(c);
    if (!person) return c.json({ error: "Say something in the chat first." }, 401);
    const parsed = importPreviewBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: `Paste up to ${IMPORT_TEXT_LIMIT} characters.` }, 400);
    }
    const gate = await checkRate(person.id);
    if (!gate.allowed) return c.json({ error: gate.message }, 429);
    await noteModelCall(person.id, CHANNEL, "import", model.id);
    try {
      const facts = await findImportFacts(
        parsed.data.text,
        new Date().toISOString().slice(0, 10),
        async (request) => (await generateText({ model: model.primary, ...request })).text,
      );
      return c.json({ facts });
    } catch (err) {
      console.error("[import] preview", err instanceof Error ? err.name : "error");
      return c.json({ error: "Could not read that note just now. Try again." }, 502);
    }
  })
  .post("/api/me/import", async (c) => {
    const person = await mePerson(c);
    if (!person) return c.json({ error: "Say something in the chat first." }, 401);
    const parsed = importBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Pick at least one fact to keep." }, 400);
    const gate = await checkRate(person.id);
    if (!gate.allowed) return c.json({ error: gate.message }, 429);
    await noteCommand(person.id, CHANNEL);
    const tally = await keepImportedFacts(parsed.data.facts, (fact) =>
      rememberFact({ person, channel: IMPORT_CHANNEL, ...fact }),
    );
    return c.json(tally);
  })
  .get("/api/me/usage", async (c) => {
    const person = await mePerson(c);
    if (!person) return c.json({ answers: 0, withMemory: 0, uses: {} });
    return c.json(await usageFor(person.id));
  })
  .get("/api/me/changes", async (c) => {
    const person = await mePerson(c);
    if (!person) return c.json({ changes: [] });
    const gate = await checkRate(person.id);
    if (!gate.allowed) return c.json({ error: gate.message }, 429);
    await noteCommand(person.id, CHANNEL);
    const port = await portFor(person, "web");
    const changes = await memoryChanges(port).catch(() => null);
    if (changes === null) {
      return c.json({ error: "Walrus Memory could not be reached just now." }, 502);
    }
    return c.json({ changes });
  })
  .get("/api/me/memories/:id/status", async (c) => {
    const person = await mePerson(c);
    const id = idParam.safeParse(c.req.param("id"));
    if (!person || !id.success) return c.json({ error: "No memory of yours has that id." }, 404);
    const status = await writeStatus(person.id, id.data);
    if (!status.ok) return c.json({ error: "No memory of yours has that id." }, 404);
    return c.json({
      status: status.status,
      blobId: status.blobId,
      hidden: status.hidden,
      type: status.type,
    });
  })
  .post("/api/me/memories", async (c) => {
    const person = await mePerson(c);
    if (!person) return c.json({ error: "Say something first." }, 401);
    const parsed = rememberBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "A type and a fact are required." }, 400);
    const gate = await checkRate(person.id);
    if (!gate.allowed) return c.json({ error: gate.message }, 429);
    await noteCommand(person.id, CHANNEL);
    const saved = await rememberFact({
      person,
      channel: CHANNEL,
      type: parsed.data.type,
      text: parsed.data.text,
      replaces: parsed.data.replaces,
    }).catch((err) => {
      console.error("[memory] remember failed", err instanceof Error ? err.name : "error");
      return null;
    });
    if (!saved) return c.json({ error: "Could not store that. Try again." }, 502);
    if (!saved.ok) {
      return c.json(
        {
          error:
            saved.reason === "type"
              ? "That is not a memory type hippo stores."
              : "Write the fact in a few words, then try again.",
        },
        400,
      );
    }
    return c.json({
      saved: saved.saved,
      ...(saved.indexId ? { indexId: saved.indexId } : {}),
      ...(saved.blobId ? { blobId: saved.blobId } : {}),
    });
  })
  .post("/api/me/memory", async (c) => {
    const person = await mePerson(c);
    if (!person) return c.json({ error: "Say something first." }, 401);
    const parsed = memoryBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Say whether memory should be on." }, 400);
    const gate = await checkRate(person.id);
    if (!gate.allowed) return c.json({ error: gate.message }, 429);
    await noteCommand(person.id, CHANNEL);
    await setMemoryEnabled(person.id, parsed.data.enabled);
    return c.json({ memoryEnabled: parsed.data.enabled });
  })
  .get("/api/conversations/:id/memories", async (c) => {
    const person = await mePerson(c);
    const id = idParam.safeParse(c.req.param("id"));
    if (!person || !id.success) return c.json({ error: "That chat is gone." }, 404);
    const found = await memoriesForChat(person, id.data);
    if (!found.ok) return c.json({ error: "That chat is gone." }, 404);
    return c.json({
      limited: found.limited,
      ...(found.limited ? { message: found.message } : {}),
      memories: found.memories,
    });
  })
  .post("/api/conversations/:id/citations", async (c) => {
    const person = await mePerson(c);
    const id = idParam.safeParse(c.req.param("id"));
    if (!person || !id.success) return c.json({ error: "That chat is gone." }, 404);
    const page = await readWebMessages(person.id, id.data, null, PAGE_SIZE);
    if (!page.ok) return c.json({ error: "That chat is gone." }, 404);
    const hidden = await hiddenBlobs(person.id);
    const messages = page.messages.map((message) => ({
      id: message.id,
      cites: dropHidden(message.cites ?? [], hidden),
    }));
    const resolved = await resolveStoredCitations(person, CHANNEL, messages);
    return c.json(resolved);
  });
