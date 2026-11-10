import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex w-fit shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3",
    {
        variants: {
            variant: {
                default: "bg-primary/10 text-primary",
                secondary: "bg-secondary text-secondary-foreground",
                outline: "border text-foreground",
                muted: "bg-muted text-muted-foreground",
                draft: "bg-status-draft/12 text-status-draft",
                pending: "bg-status-pending/15 text-[oklch(0.5_0.13_60)]",
                rejected: "bg-status-rejected/12 text-status-rejected",
                approved: "bg-status-approved/14 text-status-approved",
                invalid: "bg-status-invalid/12 text-status-invalid line-through decoration-1",
            },
        },
        defaultVariants: { variant: "default" },
    },
);

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
    return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
