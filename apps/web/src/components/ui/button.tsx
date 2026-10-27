import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent text-sm font-medium whitespace-nowrap select-none transition-[scale,opacity] duration-100 outline-none active:scale-[0.97] focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-[0.42] aria-invalid:border-ob-danger aria-invalid:ring-[3px] aria-invalid:ring-ob-danger-focus [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/82",
        destructive:
          "bg-ob-danger-soft text-ob-danger hover:bg-ob-danger-soft-hover focus-visible:border-ob-danger-focus",
        outline:
          "border-ob-border bg-ob-control text-ob-secondary hover:bg-ob-control-hover hover:text-ob-text aria-expanded:bg-ob-control-hover aria-expanded:text-ob-text",
        secondary:
          "bg-ob-control-hover text-ob-text hover:bg-ob-control-active aria-expanded:bg-ob-control-active",
        ghost:
          "bg-transparent text-ob-muted hover:bg-ob-control-hover hover:text-ob-text aria-expanded:bg-ob-control-hover aria-expanded:text-ob-text",
        link: "text-ob-text underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 rounded-md px-3 text-xs has-[>svg]:px-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
