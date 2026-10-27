# `apps/web/src/openbot/`: openbot's UI, ported to React (PolyForm Noncommercial 1.0.0)

Everything in this folder is ported from [openbot](https://github.com/nightly-labs/openbot) by
Synthetify Labs, at upstream commit `aa3c498c73362aa13898771f20d212c704a16100` (Oct 27, 2026).

- **License:** [PolyForm Noncommercial 1.0.0](LICENSE), not Remora's MIT. Use it only for noncommercial
  purposes. Anyone who gets a copy of any part of this folder also gets `LICENSE`, including its two
  `Required Notice:` lines.
- **Why it's here:** [ADR-0069](../../../../docs/adr/0069-openbot-ui-ported-under-polyform.md).
- **How it was made:** read from a clone of the upstream source and rewritten for React, Radix and
  Tailwind 4. No upstream code was installed or run.
- **The boundary:** the code in this folder is presentational: tokens, CSS, and React components that take
  props and render markup.
  - Remora's pages, data, hooks, copy, logo and avatars live outside it and stay MIT.
  - **Ported code goes nowhere else.** Every file here starts with a header naming its upstream source.
- **Not taken:**
  - openbot's brand: the logo, wordmark, app icons, the bloub blob avatars and marketing art;
  - provider and Font Awesome marks;
  - its i18n copy;
  - the Electron and desktop-only pieces;
  - its stores and controllers.

## Files and their upstream sources

| File | Upstream (paths in `nightly-labs/openbot`) |
|---|---|
| `LICENSE` | `LICENSE` (verbatim) |
| `tokens.css` | `packages/brand/src/tokens.css`, `packages/brand/src/tokens-light.css` |
| `theme.css` | `apps/mobile/global.css` (the `@theme inline` mapping), `packages/brand/src/tokens.css` |
| `base.css` | `src/renderer/src/styles/base.css`, `packages/ui/src/features/account/auth.css` (scroll bars), `packages/ui/src/styles/primitives.css` (links, reduced motion) |
| `shell/shell.css` | `src/renderer/src/features/window/window.css`, `packages/ui/src/features/window/page-rail.css`, `src/renderer/src/styles/app-shell.css`, `packages/ui/src/features/channels/channel-avatar.css`, `packages/ui/src/features/conversation/styles/header-layout.css`, `header-controls.css`, `src/renderer/src/features/web-client/web-client.css` |
| `shell/window.tsx` | `src/renderer/src/WorkspaceShell.tsx`, `WorkspaceFrame.tsx`, `src/renderer/src/features/web-client/WebWorkspace.tsx`, `packages/ui/src/features/conversation/ConversationHeader.tsx` |
| `shell/page-rail.tsx` | `packages/ui/src/features/window/PageRail.tsx` |
| `shell/sidebar.tsx` | `packages/ui/src/features/sidebar/` (`SidebarFrame.tsx`, `SidebarTopbar.tsx`, `SidebarSearch.tsx`, `SidebarSectionHeader.tsx`, `SidebarSectionList.tsx`, `SidebarWaitingGroup.tsx`, `SidebarAgentRow.tsx`, `SidebarChannelRow.tsx`, `SidebarAgentIndicator.tsx`), `packages/ui/src/features/channels/ChannelAvatar.tsx` |
| `shell/panel-resizer.tsx` | `packages/ui/src/components/PanelResizer.tsx`, `src/renderer/src/WorkspaceLeftPanelResizer.tsx` |
| `shell/side-panel.tsx` | `packages/ui/src/features/conversation/SidePanel.tsx`, `src/renderer/src/features/conversation/ConversationPanels.tsx` |
| `shell/global-search.css` | `src/renderer/src/styles/app-shell.css` (`.global-search-*`), `packages/ui/src/styles/primitives.css` (`.ui-dialog-content`) |
| `shell/mobile-navigation.tsx` | `src/renderer/src/features/web-client/WebMobileNavigation.tsx` |
| `conversation/conversation.css` | `packages/ui/src/styles/primitives.css` (bubble, message, marker), `packages/ui/src/features/conversation/styles/` (`messages.css`, `message-content.css`, `timeline.css`, `agent-steps.css`, `interaction-cards.css`, `composer.css`, `agent-chat-empty.css`, `panel-layout.css`), `src/renderer/src/styles/app-shell.css` (typing dots) |
| `conversation/conversation.tsx` | `packages/ui/src/features/conversation/` (`ChatMessageRow.tsx`, `MessageRendering.tsx`, `ChatActionMarker.tsx`, `AgentSteps.tsx`, `ConversationPrompts.tsx`, `AgentActivity.tsx`, `ComposerEditor.tsx`, `AgentChatEmptyState.tsx`), `packages/ui/src/components/TypingDots.tsx`, `src/renderer/src/features/conversation/ConversationComposer.tsx` |
| `pages/pages.css` | `packages/ui/src/styles/primitives.css` (`.ui-card`, `.ui-item-group`, `.ui-item`, `.ui-settings-section`, `.ui-heading`), `packages/ui/src/styles/settings-panel.css`, `packages/ui/src/features/settings/settings-modal.css`, `packages/ui/src/features/usage/agent-usage-report.css`, `packages/ui/src/features/conversation/styles/message-content.css` (`.message-data-table`), `packages/ui/src/features/marketplace/marketplace.css` (`.marketplace-card`), `packages/ui/src/features/conversation/styles/agent-chat-empty.css`, `packages/ui/src/features/account/auth.css` (`.account-login`) |
| `pages/page-heading.tsx` | `packages/ui/src/settings.tsx` (`SettingsSection`), `packages/ui/src/features/settings/SettingsDialogShell.tsx` (the header) |
| `pages/settings-group.tsx` | `packages/ui/src/item.tsx` (`ItemGroup`, `Item` and its parts), `packages/ui/src/surface.tsx` (`Card`), `packages/ui/src/features/settings/settings-modal.css` (`.settings-modal-card`, `.settings-modal-row`, `.settings-modal-readonly-value`) |
| `pages/stat.tsx` | `packages/ui/src/features/usage/AgentUsageReport.tsx`, `agent-usage-report.css` (the totals and the hero number) |
| `pages/data-table.tsx` | `packages/ui/src/features/conversation/DataTable.tsx`, `styles/message-content.css` (`.message-data-table`), `packages/ui/src/features/usage/agent-usage-report.css` (`.agent-usage-table`) |
| `pages/gallery-card.tsx` | `packages/ui/src/features/marketplace/MarketplaceCards.tsx`, `marketplace.css` (`.marketplace-grid`, `.marketplace-card`) |
| `pages/empty-panel.tsx` | `packages/ui/src/features/conversation/AgentChatEmptyState.tsx`, `styles/agent-chat-empty.css` (the pitch) |
| `pages/auth-card.tsx` | `packages/ui/src/features/account/AccountLogin.tsx`, `auth.css` (`.account-login-shell`, `.account-login`, `.account-login-primary`) |
| `pages/index.ts` | `packages/ui/src/index.ts` (the page parts' public surface) |
| `index.ts` | (this folder's public surface) |
