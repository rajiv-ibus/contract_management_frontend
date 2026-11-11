import { useMemo } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { describeCondition } from "../engine";
import type { FieldDef, FieldLibrary } from "../model";
import {
    DERIVE_TEXT,
    TYPE_LABEL,
    appliesToList,
    conditionKeys,
    describeConstraints,
    describeRule,
    ruleFieldKeys,
} from "./describe";
import { Chip, DefRow, LevelPill, Mono, ReqBadge, TierBadge, useRetained } from "./shared";

interface FieldDialogProps {
    library: FieldLibrary;
    field: FieldDef | null;
    onClose: () => void;
}

const PARTY_SCOPE_TEXT = {
    all: "Repeated for every party on the document",
    internal: "Repeated for each internal (iBUS) party",
    external: "Repeated for each external party",
} as const;

export function FieldDialog({ library, field, onClose }: FieldDialogProps) {
    const shown = useRetained(field);
    return (
        <Dialog open={field !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[85vh] max-w-2xl gap-0 overflow-hidden p-0">
                {shown && <FieldDetails library={library} field={shown} />}
            </DialogContent>
        </Dialog>
    );
}

function FieldDetails({ library, field }: { library: FieldLibrary; field: FieldDef }) {
    const labels = useMemo(() => new Map(library.fields.map((f) => [f.key, f.label])), [library.fields]);
    const labelOf = (key: string) => labels.get(key) ?? key;

    const rules = useMemo(
        () => library.rules.filter((r) => ruleFieldKeys(r).includes(field.key)),
        [library.rules, field.key],
    );
    const referencedBy = useMemo(
        () =>
            library.fields.filter(
                (f) =>
                    f.key !== field.key &&
                    [...conditionKeys(f.requiredWhen), ...conditionKeys(f.showWhen)].includes(field.key),
            ),
        [library.fields, field.key],
    );

    const constraints = describeConstraints(field);
    const applies = appliesToList(library, field);

    return (
        <>
            <DialogHeader className="gap-2 border-b px-6 py-4">
                <DialogTitle>{field.label}</DialogTitle>
                <DialogDescription asChild>
                    <div className="flex flex-wrap items-center gap-2">
                        <Mono>{field.key}</Mono>
                        <LevelPill level={field.level} />
                        <ReqBadge req={field.req} long />
                        <Chip>{TYPE_LABEL[field.type]}</Chip>
                    </div>
                </DialogDescription>
            </DialogHeader>

            <dl className="min-h-0 flex-1 overflow-y-auto px-6 py-2">
                {field.description && <DefRow label="Description">{field.description}</DefRow>}
                <DefRow label="Section">{field.section || "Other"}</DefRow>
                <DefRow label="Applies to">
                    <div className="flex flex-wrap gap-1.5">
                        {applies.map((a) => (
                            <Chip key={a} className={field.level === "L3" ? "font-mono" : undefined}>
                                {a}
                            </Chip>
                        ))}
                    </div>
                </DefRow>
                <DefRow label="Scope">
                    {field.partyScope ? PARTY_SCOPE_TEXT[field.partyScope] : "Once per document"}
                </DefRow>
                <DefRow label="Requirement">
                    {field.req === "M" && "Mandatory: a real value or NOT STATED is required."}
                    {field.req === "O" && "Optional: may be left empty."}
                    {field.req === "D" && "Derived: the system fills it in; a Maker never types it."}
                    {field.req === "C" &&
                        (field.requiredWhen
                            ? `Mandatory when ${describeCondition(field.requiredWhen, labelOf)}.`
                            : "Conditional, but no condition is defined.")}
                </DefRow>
                <DefRow label="Visibility">
                    {field.showWhen
                        ? `Shown only when ${describeCondition(field.showWhen, labelOf)}. Hidden fields are not validated.`
                        : "Always shown."}
                </DefRow>
                {field.derive && <DefRow label="Derived from">{DERIVE_TEXT[field.derive]}</DefRow>}
                <DefRow label="Accepts">
                    <ul className="flex flex-col gap-2">
                        {constraints.map((c) => (
                            <li key={c.label}>
                                <span className="font-medium">{c.label}: </span>
                                <span className="text-muted-foreground">{c.text}</span>
                                {c.code && (
                                    <Mono className="mt-1 block w-fit max-w-full rounded bg-muted px-1.5 py-0.5 break-all">
                                        {c.code}
                                    </Mono>
                                )}
                                {c.items && (
                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                        {c.items.map((item) => (
                                            <Chip key={item}>{item}</Chip>
                                        ))}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                </DefRow>
                <DefRow label="Rules">
                    {rules.length === 0 ? (
                        <span className="text-muted-foreground">No cross-field rule mentions this field.</span>
                    ) : (
                        <ul className="flex flex-col gap-3">
                            {rules.map((r) => (
                                <li key={r.id} className="flex items-start gap-2">
                                    <TierBadge tier={r.tier} className="mt-0.5" />
                                    <div className="min-w-0">
                                        <p>{r.message}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {describeRule(r, labelOf)} <Mono>{r.id}</Mono>
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </DefRow>
                {referencedBy.length > 0 && (
                    <DefRow label="Used by">
                        <p className="mb-1.5 text-muted-foreground">
                            Other fields whose visibility or requirement depends on this one.
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {referencedBy.map((f) => (
                                <Chip key={f.key}>{f.label}</Chip>
                            ))}
                        </div>
                    </DefRow>
                )}
            </dl>
        </>
    );
}
