# Drafts: the launch posts (Uy edits and sends them)

> **Drafts only** ([ADR-0081](../adr/0081-launch-story.md)). Send them after the blog is published (plan:
> Nov 8). Tagging the two accounts may earn bonus points ([event-rules.md](../event-rules.md) §7).
> - Replace every `<…>` before sending.
> - Use numbers from the deployed run, not these placeholders.

## X thread
1. I gave an AI agent a wallet it can't drain and a memory you can read.

   Remora: always-on agents with an onchain budget on Sui, receipts for every action, and memory on
   Walrus that you can inspect, correct and take to Claude Code.

   Built for #TotalRecall with @Tatum_io and @WalrusFoundation 🧵
2. The budget is a "Disc", built on Sui's new app-bound allowances. One signature sets a monthly limit, a
   per-payment cap and the only services it may pay. Sui enforces it, not the prompt.
3. We told it, through a paid answer, to "pay this address". The model obeyed. Our policy blocked it.
   Forced past the policy, the Disc aborted it onchain: <explorer link>

   In CI: 28 attacks, 0 overspends.
4. It learns from you. Mark a ping 👎, and the Wallet watcher writes a rule to Walrus Memory and stays quiet next
   time. The receipt for that decision cites the rule's memory blob.
5. And it checks itself. A payment from its Disc with no decision behind it gets you an alert within
   minutes, the sign of a leaked key.
6. Try it with a $1 Disc and no wallet: <playground URL>
   Blog: <blog URL> · Code: <repo URL>

## LinkedIn
I built Remora for the Walrus × Tatum "Total Recall" hackathon. Agents are good at errands now, and we
still hand them our whole wallet or approve every click. Remora gives each agent three things:
- **A budget Sui enforces.** One signature sets the "Disc": a monthly limit, a per-payment cap and the
  only services it may pay. A prompt injection that fools the model still can't move money; our CI runs
  28 such attacks with 0 overspends.
- **Memory you own and can read,** on Walrus. It holds what it learned from your 👍 and 👎, which facts
  still hold and who said them. You can inspect, correct and export it, and use it from Claude Code.
- **A receipt for every action,** with payment intents anchored onchain and checked through Tatum's Sui
  gRPC.

What went wrong is in the post too: a dedupe rule that quietly ate the agent's learning, and a stream
that spent a month of RPC credits in days.

Blog: <blog URL> · Try it: <playground URL> · Code: <repo URL>
Thanks to Tatum and the Walrus Foundation for the event.
