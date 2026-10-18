/**
 * Everything hippo says to a person before they have said anything back.
 *
 * Separated from the command plumbing for two reasons. It is the copy most
 * likely to be wrong and least likely to be reviewed, and it has no business
 * importing a database, which is what kept it untested while it was living
 * inside commands.ts.
 */

/**
 * What actually happens to what you say, in the words a person would use.
 *
 * Every number here is measured, not estimated: storage lifetime from
 * docs/SPIKES.md (a memory written today gets about 210 days), and the fact
 * that ciphertext is publicly fetchable from the aggregator round trip in
 * docs/issues/12. The paragraph about not being able to delete is the
 * uncomfortable one and is the reason this command exists rather than a line in
 * /help: somebody inviting friends to test this should not be the one who has
 * to explain it.
 */
export const PRIVACY = `What happens to what you tell me:

• I decide what is worth keeping and write it to Walrus, a public storage network. Each memory is encrypted. Anyone can download the encrypted bytes; only the account that owns them can read them.
• Storage is paid per period. A memory written today lasts about seven months, then the bytes expire.
• Your memory lives in a space named after a random id, not your name or your handle. That name is visible on Sui.
• Until you run /connect, that space sits inside my own Walrus Memory account. After /connect new memories go into an account your wallet owns, and /disconnect takes my access to it away on chain.
• If you join a team, everyone in it can recall what the team has been told. Your own memory is not shared: only /team remember puts something in the team, and leaving does not take it back out, because a memory on Walrus cannot be deleted.
• What you told me before connecting stays in my account. It cannot be moved there and it cannot be deleted, so I keep reading it alongside yours, and I can still read it after you revoke me. /memory forget all makes it unrecallable.
• The chat itself, the words back and forth, stays on my server so a reload can show it again. It is encrypted there, it is not written to Walrus, and other agents cannot recall it. On the web, delete a chat from the sidebar. That removes it from my server. It does not remove what I remembered to Walrus, and /memory off does not delete those chats.

What you can do:

• /memory off stops me remembering anything new. /memory on resumes.
• /memory shows everything I hold. /memory forget <blob> stops me using one memory; /memory forget all makes every one unrecallable.

One limit worth knowing: forgetting removes it from search so nothing can bring it back, but the encrypted bytes stay on Walrus until they expire. Nobody can delete them early, including me. If that is not a trade you want, /memory off before you tell me anything.`;

/**
 * `/start` is the only copy most people will read, so it says the one thing that
 * makes hippo different rather than listing commands. `/help` does the listing.
 *
 * It also has to disclose, in two sentences, that this writes to a public
 * network. Somebody should never learn that from an article afterwards, and
 * burying it in /help would be the same as not saying it.
 */
export function welcome(surveyUrl?: string): string {
  const lines = [
    "I remember what you tell me, across conversations and across channels.",
    "",
    "The part that is unusual: that memory can belong to you, not to me. Run /connect and it moves into a Walrus Memory account owned by your own wallet, where /disconnect takes my access away on-chain whenever you want.",
    "",
    "Before you start: what I remember gets written to Walrus, a public storage network, encrypted. Anyone can download the encrypted bytes, only the owning account can read them, and they last about seven months. /privacy has the detail and /memory off stops me remembering anything.",
    "",
    "Otherwise just talk to me. /memory shows what I have, /help lists everything.",
  ];
  if (surveyUrl) {
    lines.push(
      "",
      `If you have a minute afterwards, telling me how it went helps a lot: ${surveyUrl}`,
    );
  }
  return lines.join("\n");
}

export const HELP = `hippo remembers what you tell it, and the memory belongs to you.

/memory            what I remember about you
/memory search <q> search your memory
/memory off | on   pause or resume remembering
/memory forget <b> stop me using one memory (all: every one)
/privacy           what is stored, where, and for how long
/link              use the same memory on another channel
/team              share a memory with a few people
/whoami            your account and where the memory lives
/proof             the memories behind my last answer
/compare           my last answer again, without memory
/export            your memory as a file you keep
/connect           own your memory in your own Walrus account
/disconnect        revoke my access on-chain
/help              this message`;

/**
 * What a person is told when a turn fails.
 *
 * Every channel used to say "something went wrong on my side, try again in a
 * moment" for everything. That is fine advice for a blip and actively wrong for
 * an exhausted model budget, where trying again in a moment will fail in
 * exactly the same way for hours. Someone testing this during the real-use week
 * deserves to know which kind of wrong it is.
 *
 * Three buckets, because three is what we can honestly distinguish from the
 * outside. Anything unrecognised falls through to the generic line rather than
 * being guessed at.
 */
export function describeFailure(err: unknown): string {
  const status =
    (err as { status?: number; statusCode?: number } | null)?.status ??
    (err as { statusCode?: number } | null)?.statusCode;
  const text = err instanceof Error ? `${err.name} ${err.message}` : String(err ?? "");
  const says = (re: RegExp) => re.test(text);

  // Out of credit, or the key is not allowed to spend. Retrying does not help,
  // and pretending otherwise wastes the person's time.
  if (status === 402 || says(/insufficient|credit|quota|billing|payment required/i)) {
    return "I have run out of model credit, so I cannot answer until that is topped up. This is on my side and waiting will not fix it. Your memory is untouched.";
  }

  if (status === 429 || says(/rate.?limit|too many requests/i)) {
    return "I am being rate limited right now. Give me a minute and ask again.";
  }

  // A stream that died, a provider outage, a database that is not answering.
  // Distinguishing further from here would be guessing.
  return "I could not get an answer out just now. Nothing you have told me before is lost, but this message may not have been remembered, so say it again once I am back.";
}
