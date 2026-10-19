/** `/onboarding` (A6): the same checklist as Home, so there is one setup story, not two. */
import { Page, PageHeader } from "@/components/app/page";
import { SetupChecklist } from "@/components/app/setup-checklist";

export function OnboardingPage() {
  return (
    <Page title="Get started" description="Create your first remora, fund it, and give it memory.">
      <PageHeader
        title="Set up Remora"
        description="Sign in with your wallet to keep your remoras, memory and budget in one place."
      />
      <SetupChecklist variant="full" />
    </Page>
  );
}
