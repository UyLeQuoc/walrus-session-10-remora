import { Hono } from "hono";
import { recordBody } from "../documents/rules.ts";
import { listDocuments, recordDocument } from "../documents/store.ts";
import { mePerson } from "./chat.ts";

export const documentRoutes = new Hono()
  .get("/api/documents", async (c) => {
    const person = await mePerson(c);
    if (!person) return c.json({ documents: [] });
    return c.json({ documents: await listDocuments(person.id) });
  })
  .post("/api/documents", async (c) => {
    const person = await mePerson(c);
    if (!person) return c.json({ error: "Connect your wallet first." }, 401);
    const parsed = recordBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        { error: "That file is not one hippo can keep: .txt or .md, up to 100 KB." },
        400,
      );
    }
    const result = await recordDocument(person, parsed.data);
    if (!result.ok) {
      return result.reason === "not-owned"
        ? c.json({ error: "Own your memory with /connect before keeping private files." }, 403)
        : c.json({ error: "That file was sealed to another account. Upload it again." }, 400);
    }
    return c.json({ id: result.id });
  });
