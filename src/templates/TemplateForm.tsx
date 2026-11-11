import { ChevronDown, Plus, Trash2, Users } from "lucide-react";
import { useCallback, useId, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { composeFields, isEmpty, isRequired } from "./engine";
import type {
    DeriveContext,
    DocumentValues,
    FieldDef,
    FieldLibrary,
    FieldValue,
    Issue,
    PartyRole,
    PartyValues,
} from "./model";
import { AddFieldDialog, FieldRow, IssueBanner } from "./TemplateFormParts";
import {
    documentSections,
    isEntityField,
    LEVEL_INFO,
    newId,
    partiesOfRole,
    partyName,
    partySections,
    type Section,
} from "./templateLayout";
import { LevelPill } from "./templateParts";

export interface TemplateFormProps {
    library: FieldLibrary;
    typeCode: string;
    values: DocumentValues;
    onChange: (next: DocumentValues) => void;
    issues: Issue[];
    derive: DeriveContext;
    disabled?: boolean;
}

const FOCUSABLE = "input, select, textarea, button, [tabindex]";

function focusById(id: string): boolean {
    const el = document.getElementById(id);
    if (!el) return false;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const target = el.matches(FOCUSABLE) ? el : el.querySelector<HTMLElement>(FOCUSABLE);
    (target ?? el).focus({ preventScroll: true });
    return true;
}

// min-w-0 on the items lets wide content (tables, long unbroken text) shrink to the column instead of widening it.
const GRID = "grid gap-x-5 gap-y-4 md:grid-cols-2 [&>*]:min-w-0";

export function TemplateForm({ library, typeCode, values, onChange, issues, derive, disabled }: TemplateFormProps) {
    const type = useMemo(() => library.documentTypes.find((t) => t.code === typeCode), [library, typeCode]);
    const composed = useMemo(() => composeFields(library, typeCode, values.custom), [library, typeCode, values.custom]);
    const sections = useMemo(() => documentSections(composed, values.fields), [composed, values.fields]);
    const allSectionNames = useMemo(() => [...new Set(composed.map((f) => f.section || "Other"))], [composed]);
    const labelOf = useCallback((key: string) => composed.find((f) => f.key === key)?.label ?? key, [composed]);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const [adding, setAdding] = useState(false);
    // Bumped on every open so the dialog starts from a blank form each time (a controlled dialog is never told).
    const [addSession, setAddSession] = useState(0);
    const customKeys = useMemo(() => new Set(values.custom.map((f) => f.key)), [values.custom]);
    // Rules and conditions refer to field keys library-wide, so a one-off field must not reuse any key in the library.
    const takenKeys = useMemo(
        () => [...library.fields.map((f) => f.key), ...composed.map((f) => f.key), ...values.custom.map((f) => f.key)],
        [library.fields, composed, values.custom],
    );

    const setField = (key: string, next: FieldValue | undefined) => {
        const fields = { ...values.fields };
        if (next === undefined) delete fields[key];
        else fields[key] = next;
        onChange({ ...values, fields });
    };

    const setPartyField = (partyId: string, key: string, next: FieldValue | undefined) => {
        onChange({
            ...values,
            parties: values.parties.map((p) => {
                if (p.id !== partyId) return p;
                const partyValues = { ...p.values };
                if (next === undefined) delete partyValues[key];
                else partyValues[key] = next;
                return { ...p, values: partyValues };
            }),
        });
    };

    const addParty = (role: string) =>
        onChange({ ...values, parties: [...values.parties, { id: newId("party"), role, values: {} }] });

    const removeParty = (partyId: string) =>
        onChange({ ...values, parties: values.parties.filter((p) => p.id !== partyId) });

    const addCustom = (field: FieldDef) => onChange({ ...values, custom: [...values.custom, field] });

    const removeCustom = (key: string) => {
        const fields = { ...values.fields };
        delete fields[key];
        onChange({ ...values, custom: values.custom.filter((f) => f.key !== key), fields });
    };

    const jump = (issue: Issue) => {
        if (!issue.fieldKey) return;
        const id = issue.partyId ? `p-${issue.partyId}-${issue.fieldKey}` : `f-${issue.fieldKey}`;
        if (focusById(id)) return;
        setCollapsed({});
        window.setTimeout(() => focusById(id), 80);
    };

    const partyLabel = (partyId: string) => {
        const party = values.parties.find((p) => p.id === partyId);
        return party ? partyName(values.parties, party) : undefined;
    };

    return (
        <div className="flex flex-col gap-5">
            <IssueBanner issues={issues} labelOf={labelOf} partyLabel={partyLabel} onJump={jump} />

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                    {(["L1", "L2", "L3", "L4"] as const).map((level) => (
                        <span key={level} className="inline-flex items-center gap-1.5">
                            <LevelPill level={level} />
                            {LEVEL_INFO[level].name}
                        </span>
                    ))}
                </div>
                {!disabled && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="ml-auto"
                        onClick={() => {
                            setAddSession((n) => n + 1);
                            setAdding(true);
                        }}
                    >
                        <Plus />
                        Add a field
                    </Button>
                )}
            </div>

            {type && type.parties.length > 0 && (
                <PartiesCard
                    library={library}
                    roles={type.parties}
                    composed={composed}
                    values={values}
                    issues={issues}
                    derive={derive}
                    labelOf={labelOf}
                    disabled={disabled}
                    onAdd={addParty}
                    onRemove={removeParty}
                    onChange={setPartyField}
                />
            )}

            {sections.map((group) => (
                <SectionCard
                    key={group.section}
                    group={group}
                    collapsed={!!collapsed[group.section]}
                    onToggle={() => setCollapsed((c) => ({ ...c, [group.section]: !c[group.section] }))}
                    values={values}
                    issues={issues}
                    derive={derive}
                    labelOf={labelOf}
                    disabled={disabled}
                    customKeys={customKeys}
                    onChange={setField}
                    onRemoveCustom={removeCustom}
                />
            ))}

            <AddFieldDialog
                key={addSession}
                open={adding}
                onOpenChange={setAdding}
                sections={allSectionNames}
                takenKeys={takenKeys}
                onAdd={addCustom}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------------------------------------------

function SectionCard({
    group,
    collapsed,
    onToggle,
    values,
    issues,
    derive,
    labelOf,
    disabled,
    customKeys,
    onChange,
    onRemoveCustom,
}: {
    group: Section;
    collapsed: boolean;
    onToggle: () => void;
    values: DocumentValues;
    issues: Issue[];
    derive: DeriveContext;
    labelOf: (key: string) => string;
    disabled?: boolean;
    customKeys: Set<string>;
    onChange: (key: string, next: FieldValue | undefined) => void;
    onRemoveCustom: (key: string) => void;
}) {
    const panelId = useId();
    const mandatory = group.fields.filter((f) => f.req !== "D" && isRequired(f, values.fields));
    const done = mandatory.filter((f) => !isEmpty(values.fields[f.key])).length;
    return (
        <Card className="overflow-hidden">
            <h3 className="text-base font-semibold">
                <button
                    type="button"
                    aria-expanded={!collapsed}
                    aria-controls={collapsed ? undefined : panelId}
                    onClick={onToggle}
                    className="flex w-full items-center gap-2 px-5 py-4 text-left outline-none focus-visible:bg-muted/50"
                >
                    <ChevronDown
                        aria-hidden
                        className={cn("size-4 text-muted-foreground transition-transform", collapsed && "-rotate-90")}
                    />
                    {group.section}
                    {mandatory.length > 0 && (
                        <Badge variant={done === mandatory.length ? "approved" : "muted"} className="ml-auto">
                            {done}/{mandatory.length} mandatory
                        </Badge>
                    )}
                </button>
            </h3>
            {!collapsed && (
                <div id={panelId} className={cn(GRID, "border-t px-5 py-5")}>
                    {group.fields.map((f) => (
                        <FieldRow
                            key={f.key}
                            field={f}
                            value={values.fields[f.key]}
                            scope={values.fields}
                            idPrefix="f-"
                            allIssues={issues}
                            derive={derive}
                            labelOf={labelOf}
                            disabled={disabled}
                            onChange={(next) => onChange(f.key, next)}
                            onRemove={customKeys.has(f.key) ? () => onRemoveCustom(f.key) : undefined}
                        />
                    ))}
                </div>
            )}
        </Card>
    );
}

// ---------------------------------------------------------------------------------------------------------------

function PartiesCard({
    library,
    roles,
    composed,
    values,
    issues,
    derive,
    labelOf,
    disabled,
    onAdd,
    onRemove,
    onChange,
}: {
    library: FieldLibrary;
    roles: PartyRole[];
    composed: FieldDef[];
    values: DocumentValues;
    issues: Issue[];
    derive: DeriveContext;
    labelOf: (key: string) => string;
    disabled?: boolean;
    onAdd: (role: string) => void;
    onRemove: (partyId: string) => void;
    onChange: (partyId: string, key: string, next: FieldValue | undefined) => void;
}) {
    return (
        <Card className="overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4">
                <Users className="size-4 text-muted-foreground" />
                <h3 className="text-base font-semibold">Parties</h3>
            </div>
            <div className="flex flex-col gap-5 border-t px-5 py-5">
                {roles.map((role) => {
                    const list = partiesOfRole(values.parties, role.role);
                    return (
                        <div key={role.role} className="flex flex-col gap-3">
                            <div className="flex items-center gap-2">
                                <h4 className="text-sm font-semibold">{role.role}</h4>
                                <Badge variant={role.internal ? "default" : "muted"}>
                                    {role.internal ? "iBUS side" : "Counterparty"}
                                </Badge>
                            </div>
                            {list.length === 0 && (
                                <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed px-4 py-4 text-sm text-muted-foreground">
                                    No {role.role} added yet.
                                    {!disabled && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onAdd(role.role)}
                                        >
                                            <Plus />
                                            Add {role.role}
                                        </Button>
                                    )}
                                </div>
                            )}
                            {list.map((party, index) => (
                                <PartyBlock
                                    key={party.id}
                                    library={library}
                                    role={role}
                                    party={party}
                                    title={partyName(values.parties, party)}
                                    composed={composed}
                                    issues={issues}
                                    derive={derive}
                                    labelOf={labelOf}
                                    disabled={disabled}
                                    onRemove={index > 0 && !disabled ? () => onRemove(party.id) : undefined}
                                    onChange={(key, next) => onChange(party.id, key, next)}
                                />
                            ))}
                            {list.length > 0 && !disabled && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="w-fit"
                                    onClick={() => onAdd(role.role)}
                                >
                                    <Plus />
                                    Add another {role.role}
                                </Button>
                            )}
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}

function PartyBlock({
    library,
    role,
    party,
    title,
    composed,
    issues,
    derive,
    labelOf,
    disabled,
    onRemove,
    onChange,
}: {
    library: FieldLibrary;
    role: PartyRole;
    party: PartyValues;
    title: string;
    composed: FieldDef[];
    issues: Issue[];
    derive: DeriveContext;
    labelOf: (key: string) => string;
    disabled?: boolean;
    onRemove?: () => void;
    onChange: (key: string, next: FieldValue | undefined) => void;
}) {
    const sections = useMemo(() => partySections(composed, role, party.values), [composed, role, party.values]);
    const partyIssues = useMemo(() => issues.filter((i) => i.partyId === party.id), [issues, party.id]);
    return (
        <div className="rounded-lg border bg-muted/20 p-4">
            <div className="mb-3 flex items-center gap-2">
                <span className="text-sm font-semibold">{title}</span>
                {partyIssues.some((i) => i.tier === "BLOCK") && (
                    <span className="size-2 rounded-full bg-destructive" title="Has fields to fix">
                        <span className="sr-only">Has fields to fix</span>
                    </span>
                )}
                {onRemove && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="ml-auto text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${title}`}
                        onClick={onRemove}
                    >
                        <Trash2 />
                        Remove
                    </Button>
                )}
            </div>
            <div className="flex flex-col gap-5">
                {sections.map((group) => (
                    <div key={group.section} className="flex flex-col gap-3">
                        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                            {group.section}
                        </p>
                        <div className={GRID}>
                            {group.fields.map((f) => (
                                <FieldRow
                                    key={f.key}
                                    field={f}
                                    value={party.values[f.key]}
                                    scope={party.values}
                                    idPrefix={`p-${party.id}-`}
                                    allIssues={issues}
                                    partyId={party.id}
                                    derive={derive}
                                    labelOf={labelOf}
                                    disabled={disabled}
                                    entityOptions={isEntityField(f, role) ? library.entityMaster : undefined}
                                    onChange={(next) => onChange(f.key, next)}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
