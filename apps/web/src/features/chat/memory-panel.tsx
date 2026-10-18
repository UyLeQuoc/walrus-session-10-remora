import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function MemoryPanel({
  open,
  mobile,
  onClose,
  children,
}: {
  open: boolean;
  mobile: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const body = <div className="flex min-h-0 flex-1 flex-col">{children}</div>;
  if (mobile) {
    return (
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Memory</SheetTitle>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <div data-state={open ? "open" : "closed"} className="group/memory contents">
      <div className="w-80 shrink-0 transition-[width] duration-200 ease-linear group-data-[state=closed]/memory:w-0" />
      <aside
        data-slot="memory-panel"
        inert={open ? undefined : true}
        aria-hidden={open ? undefined : true}
        className="absolute inset-y-0 right-0 z-10 flex w-80 flex-col border-l bg-background transition-transform duration-200 ease-linear group-data-[state=closed]/memory:translate-x-full"
      >
        <div className="flex items-center justify-end px-4 py-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close memory"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
        {body}
      </aside>
    </div>
  );
}
