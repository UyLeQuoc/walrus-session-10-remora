import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const badgeVariants = cva(
  "inline-flex h-[22px] w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow,background-color] focus-visible:ring-1 focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-ob-accent text-white [a&]:hover:bg-ob-accent-hover",
        secondary:
          "bg-ob-control-hover text-ob-secondary [a&]:hover:bg-ob-control-active",
        destructive:
          "bg-ob-danger-soft text-ob-danger-text [a&]:hover:bg-ob-danger-soft-hover",
        outline:
          "border-ob-border-strong text-ob-secondary [a&]:hover:bg-ob-hover",
        accent: "bg-ob-accent-soft text-ob-accent-text",
        success: "bg-ob-success-soft text-ob-success-text [a&]:hover:bg-ob-success-soft",
        warning: "bg-ob-warning-soft text-ob-warning-text [a&]:hover:bg-ob-approval-soft",
        ghost: "text-ob-secondary [a&]:hover:bg-ob-hover",
        link: "text-ob-accent-text underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
