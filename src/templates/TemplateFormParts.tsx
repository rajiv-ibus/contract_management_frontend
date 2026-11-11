// Pieces of the editable form: one field row, the issue banner and the "Add a field" dialog.
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input, Label, NativeSelect, Switch } from "@/components/ui/form";
import { cn } from "@/lib/utils";

import { countByTier, deriveValue, describeCondition, isRequired, issuesFor } from "./engine";
import { FieldInput } from "./inputs/FieldInput";
import type { DeriveContext, FieldDef, FieldType, FieldValue, Issue } from "./model";
import { isLongType, uniqueKey } from "./templateLayout";
import { LevelPill, TIER_STYLE } from "./templateParts";

// ---------------------------------------------------------------------------------------------------------------
// Field row
// ---------------------------------------------------------------------------------------------------------------

export interface FieldRowProps {
    field: FieldDef;
    value: FieldValue | undefined;
    /** Values the field's conditions are evaluated against: the document's, or the party's own. */
    scope: Record<string, FieldValue>;
    idPrefix: string;
    allIssues: Issue[];
    partyId?: string;
    derive: DeriveContext;
    labelOf: (key: string) => string;
    disabled?: boolean;
    entityOptions?: string[];
    onChange: (next: FieldValue | undefined) => void;
    onRemove?: () => void;
}

export function FieldRow(props: FieldRowProps) {
    const { field, value, scope, idPrefix, allIssues, partyId, derive, labelOf, disabled, entityOptions } = props;
    const id = `${idPrefix}${field.key}`;
    const span = isLongType(field.type) ? "md:col-span-2" : "";

    if (field.req === "D") {
        const derived = deriveValue(field, derive, scope);
        return (
            <div className={cn("flex flex-col gap-1.5", span)}>
                <div className="flex items-center gap-2">
                    <Label>{field.label}</Label>
                    <LevelPill level={field.level} />
                    <Badge variant="muted" className="px-1.5 py-px text-[10px]">
                        Derived
                    </Badge>
                </div>
                {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
                <div
                    id={id}
                    className={cn(
                        "min-h-9 rounded-md border border-dashed bg-muted/40 px-3 py-2 text-sm",
                        !derived && "text-muted-foreground italic",
                    )}
                >
                    {derived || "Filled in by the system"}
                </div>
            </div>
        );
    }

    const required = isRequired(field, scope);
    const conditional = field.req === "C" && !required ? field.requiredWhen : undefined;
    return (
        <div className={cn("flex flex-col gap-1.5", span)}>
            <div className="flex items-center gap-2">
                <Label htmlFor={id}>
                    {field.label}
                    {required && <span className="ml-0.5 text-destructive">*</span>}
                </Label>
                <LevelPill level={field.level} />
                {props.onRemove && !disabled && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="ml-auto size-6 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove field ${field.label}`}
                        onClick={props.onRemove}
                    >
                        <Trash2 className="size-3.5" />
                    </Button>
                )}
            </div>
            {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
            {conditional && (
                <p className="text-xs text-muted-foreground">
                    Mandatory when {describeCondition(conditional, labelOf)}
                </p>
            )}
            <FieldInput
                id={id}
                field={field}
                value={value}
                onChange={props.onChange}
                issues={issuesFor(allIssues, field.key, partyId)}
                required={required}
                disabled={disabled}
                entityOptions={entityOptions}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------------------------------------------
// Issue banner
// ---------------------------------------------------------------------------------------------------------------

const TIER_SUMMARY = {
    BLOCK: (n: number) => `${n} must be fixed to submit`,
    WARN: (n: number) => `${n} ${n === 1 ? "warning" : "warnings"} for the Checker`,
    FLAG: (n: number) => `${n} ${n === 1 ? "note" : "notes"} for the signer`,
} as const;

const TIERS = ["BLOCK", "WARN", "FLAG"] as const;

export function IssueBanner({
    issues,
    labelOf,
    partyLabel,
    onJump,
}: {
    issues: Issue[];
    labelOf: (key: string) => string;
    partyLabel: (partyId: string) => string | undefined;
    onJump: (issue: Issue) => void;
}) {
    const [open, setOpen] = useState(false);
    if (issues.length === 0) return null;
    const counts = countByTier(issues);
    const ordered = TIERS.flatMap((tier) => issues.filter((i) => i.tier === tier));

    return (
        <div className="rounded-xl border bg-card shadow-xs">
            {/* Only the one-line summary is announced; the expandable list below is not a live region. */}
            <p role="status" className="sr-only">
                {TIERS.filter((tier) => counts[tier] > 0)
                    .map((tier) => TIER_SUMMARY[tier](counts[tier]))
                    .join(", ")}
            </p>
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left"
            >
                {TIERS.filter((tier) => counts[tier] > 0).map((tier) => {
                    const Icon = TIER_STYLE[tier].icon;
                    return (
                        <span
                            key={tier}
                            className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                                TIER_STYLE[tier].chip,
                            )}
                        >
                            <Icon className="size-3.5" />
                            {TIER_SUMMARY[tier](counts[tier])}
                        </span>
                    );
                })}
                <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                    {open ? "Hide details" : "Show details"}
                    <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
                </span>
            </button>
            {open && (
                <ul className="divide-y border-t">
                    {ordered.map((issue, i) => {
                        const Icon = TIER_STYLE[issue.tier].icon;
                        const who = issue.partyId ? partyLabel(issue.partyId) : undefined;
                        const label = issue.fieldKey ? `${who ? `${who}: ` : ""}${labelOf(issue.fieldKey)}` : undefined;
                        const body = (
                            <>
                                <Icon className={cn("mt-0.5 size-4 shrink-0", TIER_STYLE[issue.tier].text)} />
                                <span className="min-w-0 text-sm">
                                    {label && <span className="font-medium">{label}: </span>}
                                    {issue.message}
                                </span>
                            </>
                        );
                        return (
                            <li key={`${issue.ruleId ?? issue.fieldKey ?? "x"}-${i}`}>
                                {issue.fieldKey ? (
                                    <button
                                        type="button"
                                        onClick={() => onJump(issue)}
                                        className="flex w-full items-start gap-2 px-4 py-2 text-left hover:bg-muted/50"
                                    >
                                        {body}
                                    </button>
                                ) : (
                                    <div className="flex items-start gap-2 px-4 py-2">{body}</div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------------------------------------------
// Add a field to this document only (L4)
// ---------------------------------------------------------------------------------------------------------------

const CUSTOM_TYPES: { type: FieldType; label: string }[] = [
    { type: "text", label: "Text" },
    { type: "longtext", label: "Long text" },
    { type: "date", label: "Date" },
    { type: "money", label: "Money" },
    { type: "integer", label: "Whole number" },
    { type: "percent", label: "Percent" },
    { type: "enum", label: "Choice from a list" },
    { type: "boolean", label: "Yes / No" },
];

const NEW_SECTION = "__new__";

export function AddFieldDialog({
    open,
    onOpenChange,
    sections,
    takenKeys,
    onAdd,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sections: string[];
    takenKeys: string[];
    onAdd: (field: FieldDef) => void;
}) {
    const [label, setLabel] = useState("");
    const [type, setType] = useState<FieldType>("text");
    const [options, setOptions] = useState("");
    const [sectionChoice, setSectionChoice] = useState(sections[0] ?? NEW_SECTION);
    const [newSection, setNewSection] = useState("");
    const [mandatory, setMandatory] = useState(false);

    const reset = () => {
        setLabel("");
        setType("text");
        setOptions("");
        setSectionChoice(sections[0] ?? NEW_SECTION);
        setNewSection("");
        setMandatory(false);
    };

    const optionList = options
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
    const section = sectionChoice === NEW_SECTION ? newSection.trim() : sectionChoice;
    const problem = !label.trim()
        ? "Give the field a label"
        : type === "enum" && optionList.length === 0
          ? "Enter at least one option, separated by commas"
          : !section
            ? "Choose or name a section"
            : null;

    const submit = () => {
        if (problem) return;
        onAdd({
            key: uniqueKey(label, takenKeys),
            label: label.trim(),
            type,
            level: "L4",
            req: mandatory ? "M" : "O",
            section,
            ...(type === "enum" ? { options: [...new Set(optionList)] } : {}),
        });
        onOpenChange(false);
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (next) reset();
                onOpenChange(next);
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add a field to this document</DialogTitle>
                    <DialogDescription>
                        The field is added to this document only. It will not appear on other documents.
                    </DialogDescription>
                </DialogHeader>
                <form
                    className="flex flex-col gap-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        submit();
                    }}
                >
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="new-field-label">Label</Label>
                        <Input
                            id="new-field-label"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            placeholder="e.g. Site inspection date"
                            autoFocus
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="new-field-type">Type</Label>
                        <NativeSelect
                            id="new-field-type"
                            value={type}
                            onChange={(e) => setType(e.target.value as FieldType)}
                        >
                            {CUSTOM_TYPES.map((t) => (
                                <option key={t.type} value={t.type}>
                                    {t.label}
                                </option>
                            ))}
                        </NativeSelect>
                    </div>
                    {type === "enum" && (
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="new-field-options">Options</Label>
                            <Input
                                id="new-field-options"
                                value={options}
                                onChange={(e) => setOptions(e.target.value)}
                                placeholder="Comma-separated, e.g. Yes, No, Not applicable"
                            />
                        </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="new-field-section">Section</Label>
                        <NativeSelect
                            id="new-field-section"
                            value={sectionChoice}
                            onChange={(e) => setSectionChoice(e.target.value)}
                        >
                            {sections.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                            <option value={NEW_SECTION}>New section...</option>
                        </NativeSelect>
                        {sectionChoice === NEW_SECTION && (
                            <Input
                                value={newSection}
                                onChange={(e) => setNewSection(e.target.value)}
                                placeholder="Name of the new section"
                                aria-label="New section name"
                            />
                        )}
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                        <Label htmlFor="new-field-mandatory" className="flex flex-col gap-0.5">
                            Mandatory
                            <span className="text-xs font-normal text-muted-foreground">
                                The document cannot be submitted until it is answered or marked NOT STATED.
                            </span>
                        </Label>
                        <Switch id="new-field-mandatory" checked={mandatory} onCheckedChange={setMandatory} />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!!problem} title={problem ?? undefined}>
                            <Plus />
                            Add field
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
