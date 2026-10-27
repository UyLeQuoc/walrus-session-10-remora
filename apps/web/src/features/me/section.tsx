/** A titled block of the Chat memory tab, drawn as openbot's settings section (ADR-0069). */
import type { ReactNode } from "react";
import { SettingsSection } from "@/openbot/pages";

export function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SettingsSection title={title} description={description} actions={action}>
      {children}
    </SettingsSection>
  );
}
