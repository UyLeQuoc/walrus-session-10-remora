// Read-only: does Tatum stream SubscribeCheckpoints with an emitModule filter? Prints frames for ~20 s.
import { createTatumSuiClient, tatumSuiOptionsFromEnv } from "@remora/chain";
import { DEPLOYMENTS } from "@remora/schema";

const client = createTatumSuiClient(tatumSuiOptionsFromEnv("testnet"));
const pkg = DEPLOYMENTS.testnet.remoraPackageId;
const ac = new AbortController();
setTimeout(() => ac.abort(), 20_000);
const call = client.subscriptionService.subscribeCheckpoints(
  {
    readMask: { paths: ["sequence_number", "summary.timestamp", "transactions.digest"] },
    filter: {
      terms: [
        {
          literals: [
            {
              negated: false,
              predicate: { oneofKind: "emitModule", emitModule: { module: `${pkg}::disc` } },
            },
          ],
        },
      ],
    },
  },
  { abort: ac.signal },
);
let frames = 0;
try {
  for await (const f of call.responses) {
    frames++;
    if (frames <= 3 || frames % 20 === 0)
      console.log("frame", frames, "cursor", f.cursor, "checkpoint?", !!f.checkpoint);
  }
} catch (e) {
  console.log("stream ended:", (e as Error).message.slice(0, 200));
}
console.log("frames", frames);
process.exit(0);
