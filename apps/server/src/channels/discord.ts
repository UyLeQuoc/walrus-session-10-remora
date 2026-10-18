import { ChannelType, Client, Events, GatewayIntentBits, Partials } from "discord.js";
import { handleIncoming } from "../chat/turn.ts";
import { env } from "../env/load.ts";
import { discordHandler } from "./handlers.ts";
import type { ChannelAdapter } from "./types.ts";

const CHANNEL = "discord";

export function discordAdapter(): ChannelAdapter | null {
  if (!env.DISCORD_TOKEN) return null;
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
  });

  const handle = discordHandler(handleIncoming);
  client.on(Events.MessageCreate, (msg) =>
    handle({
      author: { id: msg.author.id, username: msg.author.username, bot: msg.author.bot },
      channelId: msg.channelId,
      content: msg.content,
      isDirect: msg.channel.type === ChannelType.DM,
      mentionsBot: client.user ? msg.mentions.has(client.user) : false,
      sendTyping: "sendTyping" in msg.channel ? () => msg.channel.sendTyping() : undefined,
      reply: (content) => msg.reply(content),
    }),
  );

  return {
    name: CHANNEL,
    async start() {
      client.once(Events.ClientReady, (c) => console.log(`[discord] logged in as ${c.user.tag}`));
      await client.login(env.DISCORD_TOKEN);
    },
    async stop() {
      await client.destroy();
    },
  };
}
