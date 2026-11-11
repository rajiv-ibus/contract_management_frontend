// Small visual pieces shared by the form, the read view and the summary sheet.
import { AlertTriangle, Info, XCircle, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { LEVEL_INFO } from "./templateLayout";
import type { FieldLevel, RuleTier } from "./model";

const LEVEL_STYLE: Record<FieldLevel, string> = {
    L1: "bg-slate-100 text-slate-700",
    L2: "bg-indigo-50 text-indigo-700",
    L3: "bg-teal-50 text-teal-700",
    L4: "bg-violet-50 text-violet-700",
};

export function LevelPill({ level, className }: { level: FieldLevel; className?: string }) {
    return (
        <span
            title={`${LEVEL_INFO[level].name}: ${LEVEL_INFO[level].hint}`}
            className={cn(
                "inline-flex shrink-0 items-center rounded px-1.5 py-px text-[10px] font-semibold tracking-wide",
                LEVEL_STYLE[level],
                className,
            )}
        >
            {level}
        </span>
    );
}

export const TIER_STYLE: Record<
    RuleTier,
    { icon: LucideIcon; text: string; chip: string; box: string; label: string }
> = {
    BLOCK: {
        icon: XCircle,
        text: "text-destructive",
        chip: "border-destructive/30 bg-destructive/10 text-destructive",
        box: "border-destructive/30 bg-destructive/5 text-destructive",
        label: "Must fix",
    },
    WARN: {
        icon: AlertTriangle,
        text: "text-amber-700",
        chip: "border-amber-200 bg-amber-50 text-amber-700",
        box: "border-amber-200 bg-amber-50 text-amber-700",
        label: "Warning",
    },
    FLAG: {
        icon: Info,
        text: "text-sky-700",
        chip: "border-sky-200 bg-sky-50 text-sky-700",
        box: "border-sky-200 bg-sky-50 text-sky-700",
        label: "Note for signer",
    },
};
