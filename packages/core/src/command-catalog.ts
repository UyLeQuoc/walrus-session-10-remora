export const CHANNEL_COMMANDS = [
  { name: "memory", description: "what I remember about you" },
  { name: "whoami", description: "your account and where the memory lives" },
  { name: "proof", description: "the memories behind my last answer" },
  { name: "compare", description: "my last answer again, without memory" },
  { name: "export", description: "your memory as a file you keep" },
  { name: "link", description: "use the same memory on another channel" },
  { name: "team", description: "share a memory with a few people" },
  { name: "connect", description: "own your memory on-chain" },
  { name: "disconnect", description: "revoke my access" },
  { name: "privacy", description: "what is stored, where, and for how long" },
  { name: "help", description: "all commands" },
] as const;

export function telegramCommands(): Array<{ command: string; description: string }> {
  return CHANNEL_COMMANDS.map(({ name, description }) => ({ command: name, description }));
}
