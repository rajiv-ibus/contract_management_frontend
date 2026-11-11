// Pieces shared by the per-type inputs: the common aria wiring, small labelled wrappers, the add/remove buttons for
// list inputs, the stable row keys, and the issue list shown under a control.
import { CircleAlertIcon, FlagIcon, PlusIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import type { FieldDef, FieldValue, Issue, RuleTier } from "../model";

/** What every per-type input is given by FieldInput. */
export interface ControlProps {
    field: FieldDef;
    value: FieldValue | undefined;
    onChange: (next: FieldValue | undefined) => void;
    shared: SharedAria;
}

export interface SharedAria {
    /** Id of the first focusable control. Sub-controls derive theirs with `subId`. */
    id: string;
    /** A BLOCK issue exists for this field. */
    invalid: boolean;
    required: boolean;
    disabled: boolean;
    /** Ids of the hint and issue messages that describe the control. */
    describedBy?: string;
}

const FOCUSABLE = "input, select, textarea, button, [tabindex]";

/** Focus the element with this id, or its first focusable descendant when the id sits on a container. */
export function focusById(id: string): void {
    const el = document.getElementById(id);
    if (!el) return;
    const target = el.matches(FOCUSABLE) ? el : el.querySelector<HTMLElement>(FOCUSABLE);
    (target ?? el).focus();
}

export const subId = (shared: SharedAria, name: string) => `${shared.id}-${name}`;

/**
 * Attributes every control carries. The first control uses `shared.id`. Pass `label` as the accessible name when the
 * control has no visible <label htmlFor>; leave it out when it has one.
 */
export function controlAria(shared: SharedAria, id: string, label?: string, required: boolean = shared.required) {
    return {
        id,
        disabled: shared.disabled,
        "aria-label": label,
        "aria-invalid": shared.invalid || undefined,
        "aria-required": required || undefined,
        "aria-describedby": shared.describedBy,
    } as const;
}

export function SubField({
    label,
    htmlFor,
    className,
    children,
}: {
    label: string;
    htmlFor: string;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <div className={cn("flex min-w-0 flex-col gap-1", className)}>
            <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
                {label}
            </Label>
            {children}
        </div>
    );
}

export function Hint({ id, children }: { id?: string; children: React.ReactNode }) {
    return (
        <p id={id} className="text-xs text-muted-foreground">
            {children}
        </p>
    );
}

/** An input with a short unit inside its right edge (for example "%"). */
export function WithSuffix({ suffix, children }: { suffix: string; children: React.ReactNode }) {
    return (
        <div className="relative min-w-0">
            {children}
            <span
                aria-hidden
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
            >
                {suffix}
            </span>
        </div>
    );
}

export function AddButton({
    label,
    onClick,
    disabled,
    id,
}: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    id?: string;
}) {
    return (
        <Button
            id={id}
            type="button"
            variant="outline"
            size="sm"
            data-add=""
            disabled={disabled}
            onClick={onClick}
            className="self-start"
        >
            <PlusIcon />
            {label}
        </Button>
    );
}

export function RemoveButton({
    label,
    onClick,
    disabled,
    className,
}: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    className?: string;
}) {
    return (
        <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={onClick}
            className={cn("shrink-0 text-muted-foreground hover:text-destructive", className)}
        >
            <Trash2Icon />
        </Button>
    );
}

export function EmptyList({ children }: { children: React.ReactNode }) {
    return <p className="text-sm text-muted-foreground">{children}</p>;
}

// ---------------------------------------------------------------------------------------------------------------
// Stable keys for list rows
// ---------------------------------------------------------------------------------------------------------------

/**
 * Row keys that survive removal. Rows have no identity of their own (they are plain strings or objects in the
 * value), so keying by index would hand a removed row's focus and DOM state to the next row. This keeps a parallel
 * list of generated keys: the list follows the value's length, and add/remove are noted so the keys move with the rows.
 * It also returns focus somewhere sensible after an add (the new row) or a remove (the Add button).
 */
export function useRowKeys(count: number) {
    const rootRef = React.useRef<HTMLDivElement>(null);
    const state = React.useRef({ keys: [] as string[], next: 0, focus: null as null | { row: string } | "add" });
    const s = state.current;

    // Idempotent for a given count, so repeated renders (Strict Mode) agree. A value replaced from outside with a
    // different length just gets fresh keys at the end.
    while (s.keys.length < count) s.keys.push(`row-${s.next++}`);
    if (s.keys.length > count) s.keys.length = count;

    React.useEffect(() => {
        const target = s.focus;
        s.focus = null;
        const root = rootRef.current;
        if (!target || !root) return;
        const el =
            target === "add"
                ? root.querySelector<HTMLElement>("[data-add]")
                : root.querySelector<HTMLElement>(
                      `[data-row="${target.row}"] input, [data-row="${target.row}"] select`,
                  );
        el?.focus();
    });

    return {
        keys: s.keys,
        rootRef,
        /** Call just before emitting the list with one more row at the end. */
        noteAdded: () => {
            const key = `row-${s.next++}`;
            s.keys.push(key);
            s.focus = { row: key };
        },
        /** Call just before emitting the list without row `index`. */
        noteRemoved: (index: number) => {
            s.keys.splice(index, 1);
            s.focus = "add";
        },
    };
}

// ---------------------------------------------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------------------------------------------

const TIER_STYLE: Record<RuleTier, { className: string; icon: typeof CircleAlertIcon; prefix: string }> = {
    BLOCK: { className: "text-destructive", icon: CircleAlertIcon, prefix: "Error: " },
    WARN: { className: "text-amber-700 dark:text-amber-400", icon: TriangleAlertIcon, prefix: "Warning: " },
    FLAG: { className: "text-sky-700 dark:text-sky-400", icon: FlagIcon, prefix: "Flag: " },
};

const TIER_ORDER: RuleTier[] = ["BLOCK", "WARN", "FLAG"];

/** One line per issue, most severe first. Only BLOCK is announced as an alert. */
export function IssueList({ issues, id }: { issues: Issue[]; id: string }) {
    if (issues.length === 0) return null;
    const sorted = [...issues].sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
    return (
        <div id={id} className="flex flex-col gap-1">
            {sorted.map((issue, i) => {
                const style = TIER_STYLE[issue.tier];
                const Icon = style.icon;
                return (
                    <p
                        key={`${issue.tier}-${issue.ruleId ?? ""}-${i}`}
                        role={issue.tier === "BLOCK" ? "alert" : undefined}
                        data-tier={issue.tier}
                        className={cn("flex items-start gap-1.5 text-xs", style.className)}
                    >
                        <Icon aria-hidden className="mt-px size-3.5 shrink-0" />
                        <span className="min-w-0 break-words">
                            <span className="sr-only">{style.prefix}</span>
                            {issue.message}
                        </span>
                    </p>
                );
            })}
        </div>
    );
}
