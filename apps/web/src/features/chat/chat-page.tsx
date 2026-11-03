import type { RemoraView } from "@remora/schema";
import type { UIMessage } from "ai";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { useNewChatTick, useOpenTick, useShellTitle } from "@/app/shell";
import { AsciiOcean, type SharkSpec } from "@/components/ascii-ocean";
import { Button } from "@/components/ui/button";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
} from "@/components/ui/message-scroller";
import { Popover, PopoverAnchor } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, Problem } from "@/components/visual";
import { clearActiveChat, readActiveChat } from "@/features/chat/active-chat";
import { ChatTurn } from "@/features/chat/chat-turn";
import { CitationNote } from "@/features/chat/citation-note";
import { applyComposerAction } from "@/features/chat/composer-action";
import { ComposerShell } from "@/features/chat/composer-shell";
import { Examples, rememberPendingAsk, takePendingAsk } from "@/features/chat/examples";
import { FollowUpRow } from "@/features/chat/follow-up-row";
import { GreetingLine } from "@/features/chat/greeting-line";
import { MemoryPanel } from "@/features/chat/memory-panel";
import { RememberDialog } from "@/features/chat/remember-dialog";
import { mergeCards } from "@/features/chat/remembered";
import { RememberedList } from "@/features/chat/remembered-list";
import { commandRoot, commandUsages } from "@/features/chat/slash-menu";
import { CommandGuide, SlashMenu } from "@/features/chat/slash-menu-panel";
import { Thinking } from "@/features/chat/streaming-text";
import type { UiMessage } from "@/features/chat/transcript";
import { useChatCitations } from "@/features/chat/use-chat-citations";
import { useChatMemories } from "@/features/chat/use-chat-memories";
import { useChatModel } from "@/features/chat/use-chat-model";
import { useChatThread } from "@/features/chat/use-chat-thread";
import { questionBefore, useCompare } from "@/features/chat/use-compare";
import { useComposerMeter } from "@/features/chat/use-composer-meter";
import { bumpConversations } from "@/features/chat/use-conversations";
import { useFollowUps } from "@/features/chat/use-follow-ups";
import { useGreeting } from "@/features/chat/use-greeting";
import { useMemoryPanel } from "@/features/chat/use-memory-panel";
import { useMemoryToggle } from "@/features/chat/use-memory-toggle";
import { useRemembered } from "@/features/chat/use-remembered";
import { useSelectionRemember } from "@/features/chat/use-selection-remember";
import { useSlashMenu } from "@/features/chat/use-slash-menu";
import { useTranscript } from "@/features/chat/use-transcript";
import { useMe } from "@/features/me/use-me";
import { api } from "@/features/remoras/api";
import { useLoad, useOwner } from "@/features/remoras/hooks";
import { usePageMeta } from "@/hooks/use-page-meta";

// The empty chat's showcase backdrop; gone once the first message lands.
const OCEAN_SHARKS: SharkSpec[] = [
  { kind: "classic", size: 1 },
  { kind: "hammerhead", size: 0.8 },
  { kind: "thresher", size: 0.72 },
];

export function ChatPage() {
  const chatModel = useChatModel();
  const {
    messages,
    busy,
    error,
    conversationId,
    send: submit,
    stop,
    retry,
    edit,
    resetConversation,
    openConversation,
    replaceMessages,
    status,
  } = useChatThread({ model: chatModel.id });
  const citations = useChatCitations(conversationId, messages as UiMessage[], (next) => {
    replaceMessages(next as UIMessage[]);
  });
  const comparisons = useCompare(conversationId);
  const panel = useMemoryPanel();
  const remembered = useRemembered(messages);
  const stored = useChatMemories(conversationId, busy);
  const panelCards = mergeCards(stored.cards, remembered.cards);
  const selection = useSelectionRemember(remembered.add);
  const [text, setText] = useState("");
  const [loadId, setLoadId] = useState<string | null>(() => readActiveChat());
  const transcript = useTranscript(loadId);
  const newChatTick = useNewChatTick();
  const openTick = useOpenTick();
  const seenTick = useRef(0);
  const seenOpen = useRef(openTick);
  const applied = useRef(0);
  const wasBusy = useRef(false);

  useEffect(() => {
    if (error) toast.error(error.message);
  }, [error]);

  useEffect(() => {
    const pending = takePendingAsk();
    if (pending) setText(pending);
  }, []);

  useEffect(() => {
    if (seenTick.current === newChatTick) return;
    seenTick.current = newChatTick;
    setLoadId(null);
    resetConversation();
    setText("");
  }, [newChatTick, resetConversation]);

  useEffect(() => {
    if (openTick === 0 || seenOpen.current === openTick) return;
    seenOpen.current = openTick;
    const id = readActiveChat();
    setLoadId(id);
    openConversation(id);
  }, [openTick, openConversation]);

  useEffect(() => {
    if (transcript.generation === 0 || applied.current === transcript.generation) return;
    applied.current = transcript.generation;
    if (transcript.messages) replaceMessages(transcript.messages as UIMessage[]);
  }, [transcript.generation, transcript.messages, replaceMessages]);

  useEffect(() => {
    if (transcript.error) toast.error(transcript.error);
  }, [transcript.error]);

  useEffect(() => {
    if (busy) {
      wasBusy.current = true;
      return;
    }
    if (!wasBusy.current) return;
    wasBusy.current = false;
    bumpConversations();
  }, [busy]);

  const lastId = messages.at(-1)?.id;
  const lastUserId = lastIdOf(messages, "user");
  const lastAssistantId = lastIdOf(messages, "assistant");
  const last = messages.at(-1);
  const follow = useFollowUps({
    conversationId,
    busy,
    enabled: last?.role === "assistant" && !isCommand(last),
  });

  const send = (value: string) => {
    if (!value.trim() || busy) return;
    submit(value);
    setText("");
  };

  const title = useMemo(() => threadTitle(messages), [messages]);
  useShellTitle(title);
  usePageMeta({
    title: title === "New chat" ? "Chat · Remora" : `${title} · Remora`,
    description:
      "Talk to your remoras on the web, Telegram or Discord. Their memory lives on Walrus, in a Sui account you own and can revoke.",
    path: "/chat",
    index: false,
  });
  const greeting = useGreeting(newChatTick, messages.length === 0);
  // ADR-0103: a signed-in account with no remora gets one button, not examples for remoras it
  // doesn't have; a failing server says so above the composer.
  const { owner } = useOwner();
  const roster = useLoad(
    () =>
      owner
        ? api.remoras()
        : Promise.resolve({ ok: true as const, data: { remoras: [] as RemoraView[] } }),
    [owner],
  );
  const noRemora =
    Boolean(owner) &&
    Boolean(roster.data) &&
    !(roster.data?.remoras ?? []).some((r) => r.status !== "retired");

  const reloadAndAsk = (value: string) => {
    clearActiveChat();
    rememberPendingAsk(value);
    window.location.reload();
  };

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {transcript.loading && messages.length === 0 ? (
          <div
            className="flex flex-1 flex-col gap-3 px-4 py-6"
            role="status"
            aria-label="Loading chat"
          >
            <Skeleton className="h-16 w-2/3 self-end" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : messages.length === 0 ? (
          <div className="relative flex min-h-0 flex-1 flex-col">
            <AsciiOcean
              sharks={OCEAN_SHARKS}
              className="absolute inset-0 size-full opacity-70 [mask-image:radial-gradient(ellipse_34%_42%_at_50%_50%,rgb(0_0_0/0.15)_55%,black)] dark:opacity-85"
            />
            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-6">
              <div data-slot="empty-cluster" className="flex w-full max-w-xl flex-col gap-10">
                <div data-slot="greeting" className="flex flex-col gap-6 text-center">
                  <GreetingLine greeting={greeting} />
                </div>
                {/* Liquid glass over the ocean; index.css clears the composer's own surface inside it. */}
                <div className="liquid-glass rounded-3xl">
                  <ComposerDock
                    text={text}
                    setText={setText}
                    send={send}
                    stop={() => void stop()}
                    busy={busy}
                    messages={messages}
                    model={chatModel}
                    panelOpen={panel.open}
                    onTogglePanel={panel.open ? panel.close : panel.show}
                  />
                </div>
                {roster.error ? (
                  <Problem
                    title="Can't reach your remoras right now."
                    detail={roster.error}
                    onRetry={() => void roster.refresh()}
                  />
                ) : noRemora ? (
                  <Empty
                    title="You have no remora yet. Make one to chat with."
                    action={
                      <Button asChild>
                        <Link to="/remoras/new">
                          <Plus /> Create a remora
                        </Link>
                      </Button>
                    }
                  />
                ) : (
                  <div className="flex flex-col items-start gap-3">
                    <Examples taught={false} onPick={setText} onReloadAndAsk={reloadAndAsk} />
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <MessageScrollerProvider defaultScrollPosition="end">
              <MessageScroller className="min-h-0 flex-1">
                <MessageScrollerViewport>
                  <MessageScrollerContent className="mx-auto w-full max-w-[880px] gap-3 px-3 py-4">
                    <JumpToLatest messageId={lastId ?? null} />
                    {messages.map((m, index) => {
                      const asked = m.role === "assistant" ? questionBefore(messages, index) : null;
                      return (
                        <MessageScrollerItem key={m.id} scrollAnchor={m.role === "user"}>
                          <ChatTurn
                            message={m}
                            live={m.id === lastId && busy}
                            streaming={m.id === lastId && status === "streaming"}
                            canEdit={!busy && m.id === lastUserId}
                            canAnswer={!busy && m.id === lastAssistantId}
                            onEdit={edit}
                            onRetry={retry}
                            onRemember={(text) => selection.start({ text, type: "profile" })}
                            comparison={comparisons.byAnswer[m.id]}
                            onCompare={
                              asked ? () => void comparisons.compare(m.id, asked) : undefined
                            }
                          />
                        </MessageScrollerItem>
                      );
                    })}
                    {busy && last?.role === "user" ? (
                      <MessageScrollerItem scrollAnchor>
                        <Thinking label="Reading memories" />
                      </MessageScrollerItem>
                    ) : null}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton />
              </MessageScroller>
            </MessageScrollerProvider>
            <div
              data-slot="composer-dock"
              className="mx-auto flex w-full max-w-[904px] shrink-0 flex-col px-3 pb-3"
            >
              <CitationNote note={citations.note} onRetry={citations.retry} />
              <FollowUpRow suggestions={follow.suggestions} onPick={setText} />
              <ComposerDock
                text={text}
                setText={setText}
                send={send}
                stop={stop}
                busy={busy}
                messages={messages}
                model={chatModel}
                panelOpen={panel.open}
                onTogglePanel={panel.open ? panel.close : panel.show}
              />
            </div>
          </>
        )}
      </div>
      <MemoryPanel open={panel.open} mobile={panel.mobile} onClose={panel.close}>
        <RememberedList
          cards={panelCards}
          now={remembered.now}
          loading={stored.loading}
          error={stored.error}
          onHide={(card) => {
            void remembered.hide(card).then((result) => {
              if (!result.ok) {
                toast.error(result.message);
                return;
              }
              stored.conceal(card.key);
            });
          }}
          onCorrect={(card) =>
            selection.start({
              text: card.text,
              type: "correction",
              ...(card.blobId ? { replaces: card.blobId } : {}),
            })
          }
        />
      </MemoryPanel>
      <RememberDialog
        draft={selection.draft}
        busy={selection.busy}
        error={selection.error}
        onText={selection.setText}
        onType={selection.setType}
        onCancel={selection.cancel}
        onSubmit={(text) => {
          void selection.submit(text);
        }}
      />
    </div>
  );
}

function JumpToLatest({ messageId }: { messageId: string | null }) {
  const { scrollToEnd } = useMessageScroller();
  useEffect(() => {
    if (!messageId) return;
    scrollToEnd({ align: "end", behavior: "auto" });
  }, [messageId, scrollToEnd]);
  return null;
}

function lastIdOf(messages: Array<{ id: string; role: string }>, role: string): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === role) return messages[i]?.id ?? null;
  }
  return null;
}

function isCommand(message: { metadata?: unknown }): boolean {
  return Boolean((message.metadata as { command?: boolean } | undefined)?.command);
}

function ComposerDock({
  text,
  setText,
  send,
  stop,
  busy,
  messages,
  model,
  panelOpen,
  onTogglePanel,
}: {
  text: string;
  setText: (value: string) => void;
  send: (value: string) => void;
  stop: () => void;
  busy: boolean;
  messages: UIMessage[];
  model: ReturnType<typeof useChatModel>;
  panelOpen: boolean;
  onTogglePanel: () => void;
}) {
  return (
    <Composer
      text={text}
      setText={setText}
      send={send}
      stop={stop}
      busy={busy}
      messages={messages}
      model={model}
      panelOpen={panelOpen}
      onTogglePanel={onTogglePanel}
    />
  );
}

function Composer({
  text,
  setText,
  send,
  stop,
  busy,
  messages,
  model,
  panelOpen,
  onTogglePanel,
}: {
  text: string;
  setText: (value: string) => void;
  send: (value: string) => void;
  stop: () => void;
  busy: boolean;
  messages: UIMessage[];
  model: ReturnType<typeof useChatModel>;
  panelOpen: boolean;
  onTogglePanel: () => void;
}) {
  const [pinned, setPinned] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const root = commandRoot(text);
  const guided = pinned !== null && root === pinned;
  const applyCommand = (command: string) => {
    setText(command);
    const next = commandRoot(command);
    setPinned(next);
    setGuideOpen(next !== null);
  };
  const slash = useSlashMenu({
    text,
    busy,
    pinned: guided,
    apply: applyCommand,
  });
  const { me, memories } = useMe();
  const memory = useMemoryToggle(me?.memoryEnabled);
  const meter = useComposerMeter(messages, text);
  useEffect(() => {
    if (memory.error) toast.error(memory.error);
  }, [memory.error]);
  const submit = () => {
    applyComposerAction({ busy, text, send, stop });
  };
  const onText = (value: string) => {
    setText(value);
    if (pinned && commandRoot(value) !== pinned) {
      setPinned(null);
      setGuideOpen(false);
    }
  };
  return (
    <Popover
      open={slash.open || (guided && guideOpen)}
      modal={false}
      onOpenChange={(next) => {
        if (next) return;
        slash.dismiss();
        setGuideOpen(false);
      }}
    >
      <PopoverAnchor asChild>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <ComposerShell
            text={text}
            onText={onText}
            disabled={busy}
            busy={busy}
            meter={meter}
            command={guided}
            memory={
              typeof me?.memoryEnabled === "boolean"
                ? {
                    enabled: me.memoryEnabled,
                    pending: memory.pending,
                    onChange: (next) => {
                      void memory.toggle(next);
                    },
                  }
                : undefined
            }
            memoryStatus={{
              stored: memories.filter((m) => m.status === "stored").length,
              total: memories.length,
              mode: me?.mode ?? null,
              enabled: me?.memoryEnabled !== false,
            }}
            model={{ value: model.id, onChange: model.select }}
            panelOpen={panelOpen}
            onTogglePanel={onTogglePanel}
            onKeyDown={(e) => {
              if (slash.onKeyDown(e.key) === "handled") {
                e.preventDefault();
                return;
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
        </form>
      </PopoverAnchor>
      {slash.open ? (
        <SlashMenu
          items={slash.items}
          active={slash.active}
          onHighlight={slash.highlight}
          onRun={slash.run}
        />
      ) : guided && guideOpen && root ? (
        <CommandGuide lines={commandUsages(root)} onPick={applyCommand} />
      ) : null}
    </Popover>
  );
}

function threadTitle(messages: Array<{ role: string; parts?: Array<Record<string, unknown>> }>) {
  const firstUser = messages.find((m) => m.role === "user");
  const line = textOf(firstUser?.parts).split("\n")[0]?.trim() ?? "";
  if (!line) return "New chat";
  return line.length > 48 ? `${line.slice(0, 48)}…` : line;
}

function textOf(parts: Array<Record<string, unknown>> | undefined): string {
  return (parts ?? [])
    .filter((p) => p.type === "text")
    .map((p) => String(p.text ?? ""))
    .join("");
}
