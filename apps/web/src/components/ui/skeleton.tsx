import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-ob-sm bg-ob-control-hover", className)}
      {...props}
    />
  )
}

export { Skeleton }
