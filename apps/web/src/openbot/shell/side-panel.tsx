/*
 * Ported from nightly-labs/openbot packages/ui/src/features/conversation/SidePanel.tsx and
 * src/renderer/src/features/conversation/ConversationPanels.tsx @ aa3c498.
 * PolyForm Noncommercial 1.0.0, see ../LICENSE.
 *
 * The docked side panel: a header in the top row with the title, tabs and a close button, and a
 * scrolling body. On a phone it takes the full width (the shell shows it as its own pane).
 */
import { X } from "lucide-react";
import type { ReactNode } from "react";

export type SidePanelTab = { id: string; label: string };

export function SidePanel({
  id,
  title,
  tabs,
  activeTab,
  onTab,
  onClose,
  resizer,
  children,
}: {
  id: string;
  title: string;
  tabs?: SidePanelTab[];
  activeTab?: string;
  onTab?: (id: string) => void;
  onClose: () => void;
  resizer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <aside id={id} className="side-panel" aria-label={title}>
      {resizer}
      <div className="side-panel-header">
        <p className="side-panel-title">{title}</p>
        {tabs && tabs.length > 1 ? (
          <div className="side-panel-tabs" role="tablist" aria-label={title}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={tab.id === activeTab}
                className="side-panel-tab"
                onClick={() => onTab?.(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          className="sidebar-icon-button"
          aria-label={`Close ${title}`}
          onClick={onClose}
        >
          <X aria-hidden />
        </button>
      </div>
      <div className="side-panel-body" role={tabs && tabs.length > 1 ? "tabpanel" : undefined}>
        {children}
      </div>
    </aside>
  );
}
