/** The one empty state (ADR-0036): icon, title, one sentence, one next step (openbot's look). */
import type { ReactNode } from "react";
import { EmptyPanel } from "@/openbot/pages";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  action?: ReactNode;
}) {
  return <EmptyPanel icon={icon} title={title} description={description} action={action} />;
}
