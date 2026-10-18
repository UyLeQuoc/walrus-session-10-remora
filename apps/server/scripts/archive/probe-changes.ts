import { createMemoryPort, guestScope, loadEnv, readOperatorEnv } from "@remora/memory";
import { memoryChanges } from "../../src/memory/changes.ts";

loadEnv();
const person = process.argv[2];
if (!person) throw new Error("usage: probe-changes.ts <guest-person-id>");
const env = readOperatorEnv();
const port = createMemoryPort({
  scope: guestScope(
    {
      key: env.MEMWAL_PRIVATE_KEY,
      accountId: env.MEMWAL_ACCOUNT_ID,
      serverUrl: env.MEMWAL_SERVER_URL,
    },
    person,
  ),
  by: "probe",
  channel: "probe",
});
for (const change of await memoryChanges(port)) {
  console.log(`${change.date.slice(0, 10)}  ${change.text}`);
  console.log(
    change.replaced
      ? `  replaced ${change.replaced.certain ? "(certain)" : "(probably)"}: ${change.replaced.text}`
      : "  replaced: nothing paired",
  );
}
