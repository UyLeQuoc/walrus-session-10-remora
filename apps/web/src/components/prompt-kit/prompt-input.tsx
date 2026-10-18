import {
  type ComponentProps,
  createContext,
  type HTMLAttributes,
  type KeyboardEventHandler,
  type ReactNode,
  type RefObject,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type PromptInputContextType = {
  isLoading: boolean;
  value: string;
  setValue: (value: string) => void;
  maxHeight: number | string;
  onSubmit?: () => void;
  disabled?: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
};

const PromptInputContext = createContext<PromptInputContextType>({
  isLoading: false,
  value: "",
  setValue: () => {},
  maxHeight: 240,
  onSubmit: undefined,
  disabled: false,
  textareaRef: { current: null },
});

function usePromptInput() {
  return useContext(PromptInputContext);
}

export type PromptInputProps = {
  isLoading?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  maxHeight?: number | string;
  onSubmit?: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
} & ComponentProps<"div">;

/**
 * Prompt-kit's composer shell: a rounded field, a multiline textarea, and a
 * row of actions. Enter submits; Shift+Enter keeps the newline the textarea
 * would have inserted anyway.
 */
export function PromptInput({
  className,
  isLoading = false,
  maxHeight = 240,
  value,
  onValueChange,
  onSubmit,
  children,
  disabled = false,
  ...props
}: PromptInputProps) {
  const [internalValue, setInternalValue] = useState(value || "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (newValue: string) => {
    setInternalValue(newValue);
    onValueChange?.(newValue);
  };

  return (
    <TooltipProvider>
      <PromptInputContext.Provider
        value={{
          isLoading,
          value: value ?? internalValue,
          setValue: onValueChange ?? handleChange,
          maxHeight,
          onSubmit,
          disabled,
          textareaRef,
        }}
      >
        <div
          className={cn(
            "cursor-text rounded-3xl border border-input bg-background p-2 shadow-xs",
            disabled && "cursor-not-allowed opacity-60",
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </PromptInputContext.Provider>
    </TooltipProvider>
  );
}

function resizeToContent(el: HTMLTextAreaElement, maxHeight: number | string) {
  el.style.height = "auto";
  el.style.height =
    typeof maxHeight === "number"
      ? `${Math.min(el.scrollHeight, maxHeight)}px`
      : `min(${el.scrollHeight}px, ${maxHeight})`;
}

export function PromptInputTextarea({
  className,
  onKeyDown,
  disableAutosize = false,
  ...props
}: ComponentProps<typeof Textarea> & { disableAutosize?: boolean }) {
  const { value, setValue, maxHeight, onSubmit, disabled, textareaRef } = usePromptInput();

  const handleRef = (el: HTMLTextAreaElement | null) => {
    textareaRef.current = el;
    if (el && !disableAutosize) resizeToContent(el, maxHeight);
  };

  // `value` is a dependency on purpose: send and new chat clear it without an
  // input event, and the box has to shrink after React writes the DOM.
  // biome-ignore lint/correctness/useExhaustiveDependencies: value is the trigger, not a local read
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el || disableAutosize) return;
    resizeToContent(el, maxHeight);
  }, [value, maxHeight, disableAutosize, textareaRef]);

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit?.();
    }
    onKeyDown?.(event);
  };

  return (
    <Textarea
      {...props}
      ref={handleRef}
      value={value}
      rows={1}
      disabled={disabled}
      onChange={(event) => {
        if (!disableAutosize) resizeToContent(event.target, maxHeight);
        setValue(event.target.value);
      }}
      onKeyDown={handleKeyDown}
      className={cn(
        "min-h-11 w-full resize-none border-none bg-transparent px-3 py-2 shadow-none outline-none focus-visible:ring-0",
        className,
      )}
    />
  );
}

export function PromptInputActions({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      {children}
    </div>
  );
}

export function PromptInputAction({
  tooltip,
  children,
  className,
  side = "top",
}: {
  tooltip: ReactNode;
  children: ReactNode;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
}) {
  const { disabled } = usePromptInput();
  return (
    <Tooltip>
      <TooltipTrigger asChild disabled={disabled} onClick={(event) => event.stopPropagation()}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className={className}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
