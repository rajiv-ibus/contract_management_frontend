import * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** A label, a control and an optional hint stacked together. An app-level helper; the controls are shadcn's. */
export function Field({
    label,
    hint,
    required,
    htmlFor,
    className,
    children,
}: {
    label: string;
    hint?: string;
    required?: boolean;
    htmlFor?: string;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <div className={cn("flex flex-col gap-1.5", className)}>
            <Label htmlFor={htmlFor}>
                {label}
                {required && <span className="ml-0.5 text-destructive">*</span>}
            </Label>
            {children}
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
}
