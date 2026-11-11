import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { FieldLevel, Requirement, RuleTier } from "../model";
import { LEVEL_META, REQ_META, TIER_META } from "./describe";

const LEVEL_STYLE: Record<FieldLevel, string> = {
    L1: "bg-primary/10 text-primary",
    L2: "bg-secondary text-secondary-foreground",
    L3: "border text-foreground",
    L4: "bg-muted text-muted-foreground",
};

export function LevelPill({ level, className }: { level: FieldLevel; className?: string }) {
    return (
        <Badge title={LEVEL_META[level].title} className={cn(LEVEL_STYLE[level], className)}>
            {level} {LEVEL_META[level].name}
        </Badge>
    );
}

const REQ_VARIANT: Record<Requirement, "default" | "muted" | "secondary" | "pending"> = {
    M: "default",
    O: "muted",
    D: "secondary",
    C: "pending",
};

export function ReqBadge({ req, long, className }: { req: Requirement; long?: boolean; className?: string }) {
    return (
        <Badge variant={REQ_VARIANT[req]} title={REQ_META[req].title} className={cn("font-mono", className)}>
            <span aria-hidden={long ? undefined : true}>{req}</span>
            <span className={long ? "font-sans" : "sr-only"}>{REQ_META[req].label}</span>
        </Badge>
    );
}

export const TIER_STYLE: Record<RuleTier, string> = {
    BLOCK: "border border-destructive/30 bg-destructive/10 text-destructive",
    WARN: "border border-amber-200 bg-amber-50 text-amber-700",
    FLAG: "border border-sky-200 bg-sky-50 text-sky-700",
};

export function TierBadge({ tier, className }: { tier: RuleTier; className?: string }) {
    return (
        <Badge title={TIER_META[tier].effect} className={cn("font-semibold", TIER_STYLE[tier], className)}>
            {tier}
        </Badge>
    );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
    return <code className={cn("font-mono text-xs text-muted-foreground", className)}>{children}</code>;
}

/** One labelled row of a definition list. */
export function DefRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="grid gap-1 border-b py-3 last:border-0 sm:grid-cols-[10rem_1fr] sm:gap-4">
            <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
            <dd className="min-w-0 text-sm">{children}</dd>
        </div>
    );
}

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <span className={cn("inline-flex items-center rounded-md border bg-muted/50 px-2 py-0.5 text-xs", className)}>
            {children}
        </span>
    );
}

/**
 * The latest non-null value. A dialog's content is rendered from this so it stays on screen while the dialog plays
 * its closing animation, instead of vanishing the instant the open state is cleared.
 */
export function useRetained<T>(value: T | null): T | null {
    const [kept, setKept] = useState(value);
    if (value !== null && value !== kept) setKept(value);
    return value ?? kept;
}

/** Download text as a file in the browser. */
export function downloadText(filename: string, text: string, type = "application/json") {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export const fileSlug = (name: string) =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "project";
