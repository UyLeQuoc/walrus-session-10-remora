/**
 * The composer's model picker (Phase 6 §4). A ghost trigger with the short label opens one flat
 * list; each row shows the price per 1M and a badge with the number of input kinds, and hovering or
 * focusing the row lists them plus tool calling.
 */
import { AudioLines, Check, ChevronDown, FileText, Image, Layers, Type, Video } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type ChatModel, MODEL_INPUT_LABEL, MODELS, modelById, priceLabel } from "./models";

const INPUT_ICON = {
  text: Type,
  image: Image,
  audio: AudioLines,
  video: Video,
  file: FileText,
} as const;

/** The tooltip body: which inputs the model takes, and that it can call tools. */
export function CapabilityList({ model }: { model: ChatModel }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-medium">{model.label}</p>
      <ul className="flex flex-col gap-1">
        {model.inputs.map((input) => {
          const Icon = INPUT_ICON[input];
          return (
            <li key={input} className="flex items-center gap-2">
              <Icon className="size-3.5" /> {MODEL_INPUT_LABEL[input]}
            </li>
          );
        })}
      </ul>
      <p className="flex items-center gap-2">
        <Check className="size-3.5" aria-hidden /> Tool calling
      </p>
    </div>
  );
}

function CapabilityBadge({
  model,
  open,
  onOpenChange,
}: {
  model: ChatModel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Tooltip open={open} onOpenChange={onOpenChange}>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={`${model.inputs.length} input types`}
          className="flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
        >
          <Layers className="size-3" />
          {model.inputs.length}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" align="start" className="text-xs">
        <CapabilityList model={model} />
      </TooltipContent>
    </Tooltip>
  );
}

function ModelRow({ model }: { model: ChatModel }) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenuRadioItem
      value={model.id}
      className="items-center gap-2 pr-2"
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{model.label}</span>
        <span className="text-muted-foreground text-xs">
          {priceLabel(model)}
          {model.inputPerMillion === null ? "" : " per 1M"}
        </span>
      </span>
      <CapabilityBadge model={model} open={open} onOpenChange={setOpen} />
    </DropdownMenuRadioItem>
  );
}

export function ModelPicker({
  value,
  onChange,
  labelled = false,
}: {
  value: string;
  onChange: (id: string) => void;
  /** Always show the model's name (a settings row); the composer hides it on a phone. */
  labelled?: boolean;
}) {
  const selected = modelById(value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={labelled ? "outline" : "ghost"}
          size="sm"
          aria-label={`Model: ${selected.label}`}
          className={labelled ? "gap-1.5" : "gap-1.5 px-2 text-muted-foreground"}
        >
          <span className={labelled ? "inline" : "hidden sm:inline"}>{selected.shortLabel}</span>
          <ChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {MODELS.map((model) => (
            <ModelRow key={model.id || "default"} model={model} />
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
