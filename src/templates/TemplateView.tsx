import { Users } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Label, Switch } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import {
    composeFields,
    deriveValue,
    formatDate,
    formatValue,
    isEmpty,
    isNotStated,
    isRequired,
    issuesFor,
    NOT_STATED_LABEL,
} from "./engine";
import type {
    ContactValue,
    DeriveContext,
    DocumentValues,
    FieldDef,
    FieldLibrary,
    FieldValue,
    Issue,
    PartyRole,
    PartyValues,
    PersonValue,
    TableColumn,
} from "./model";
import {
    documentSections,
    isLongType,
    partiesOfRole,
    partyName,
    partySections,
    sameValue,
    type Section,
} from "./templateLayout";
import { LevelPill, TIER_STYLE } from "./templateParts";

export interface TemplateViewProps {
    library: FieldLibrary;
    typeCode: string;
    values: DocumentValues;
    derive: DeriveContext;
    issues?: Issue[];
    /** Highlight fields that differ from these values (an earlier version). */
    compareTo?: DocumentValues;
}

// min-w-0 on the items lets wide content (tables, long unbroken text) shrink to the column instead of widening it.
const GRID = "grid gap-x-5 gap-y-3 md:grid-cols-2 [&>*]:min-w-0";

/** What the read view shows for one field. A field is skipped when it has nothing to say. */
function fieldState(
    field: FieldDef,
    value: FieldValue | undefined,
    scope: Record<string, FieldValue>,
    derive: DeriveContext,
    showEmpty: boolean,
    compare: boolean,
    previous: FieldValue | undefined,
) {
    const derived = field.req === "D";
    const derivedText = derived ? deriveValue(field, derive, scope) : "";
    const empty = derived ? !derivedText : isEmpty(value);
    const required = !derived && isRequired(field, scope);
    // A value cleared since the earlier version stays visible: that deletion is the change.
    const changed = compare && !derived && !sameValue(value, previous);
    const shown = !empty || required || showEmpty || changed;
    return { derived, derivedText, empty, required, changed, shown };
}

interface PartyLayout {
    role: PartyRole;
    parties: { party: PartyValues; before: PartyValues | undefined; groups: Section[] }[];
}

export function TemplateView({ library, typeCode, values, derive, issues = [], compareTo }: TemplateViewProps) {
    const [showEmpty, setShowEmpty] = useState(false);
    const type = useMemo(() => library.documentTypes.find((t) => t.code === typeCode), [library, typeCode]);
    const composed = useMemo(() => composeFields(library, typeCode, values.custom), [library, typeCode, values.custom]);
    const shownIssues = useMemo(() => issues.filter((i) => i.tier !== "BLOCK"), [issues]);
    const removedParties = (compareTo?.parties ?? []).filter(
        (old) => !values.parties.some((p) => p.id === old.id && p.role === old.role),
    );

    // Only the groups that have something to print, and which fields they print, so no empty cards are drawn.
    const layout = useMemo(() => {
        const printed = new Set<string>();
        const keep = (
            groups: Section[],
            scope: Record<string, FieldValue>,
            before: Record<string, FieldValue> | undefined,
            compare: boolean,
            partyId?: string,
        ): Section[] =>
            groups
                .map((g) => ({
                    section: g.section,
                    fields: g.fields.filter((f) => {
                        const state = fieldState(f, scope[f.key], scope, derive, showEmpty, compare, before?.[f.key]);
                        if (state.shown) printed.add(`${partyId ?? ""}|${f.key}`);
                        return state.shown;
                    }),
                }))
                .filter((g) => g.fields.length > 0);

        const roles: PartyLayout[] = (type?.parties ?? []).map((role) => ({
            role,
            parties: partiesOfRole(values.parties, role.role).map((party) => {
                const before = compareTo?.parties.find((p) => p.id === party.id && p.role === party.role);
                return {
                    party,
                    before,
                    groups: keep(
                        partySections(composed, role, party.values),
                        party.values,
                        before?.values,
                        !!compareTo && !!before,
                        party.id,
                    ),
                };
            }),
        }));
        const docGroups = keep(
            documentSections(composed, values.fields),
            values.fields,
            compareTo?.fields,
            !!compareTo,
        );
        return { roles, docGroups, printed };
    }, [type, composed, values.parties, values.fields, derive, showEmpty, compareTo]);

    // Warnings and notes that no printed field carries (a rule on several fields, or a field that is not shown).
    const notes = useMemo(() => {
        const rank = { WARN: 0, FLAG: 1, BLOCK: 2 } as const;
        return shownIssues
            .filter((i) => !i.fieldKey || !layout.printed.has(`${i.partyId ?? ""}|${i.fieldKey}`))
            .map((i) => ({
                issue: i,
                label: i.fieldKey ? composed.find((f) => f.key === i.fieldKey)?.label : undefined,
            }))
            .sort((a, b) => rank[a.issue.tier] - rank[b.issue.tier]);
    }, [shownIssues, layout.printed, composed]);

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-2">
                    <Switch id="view-show-empty" checked={showEmpty} onCheckedChange={setShowEmpty} />
                    <Label htmlFor="view-show-empty" className="text-sm font-normal">
                        Show empty fields
                    </Label>
                </div>
                {compareTo && (
                    <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="size-2 rounded-full bg-amber-400" />
                        Highlighted fields changed since the earlier version
                    </p>
                )}
            </div>

            {notes.length > 0 && (
                <section aria-label="Notes on this document" className="flex flex-col gap-1.5">
                    {notes.map(({ issue, label }, i) => {
                        const Icon = TIER_STYLE[issue.tier].icon;
                        return (
                            <p
                                key={i}
                                className={cn(
                                    "flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
                                    TIER_STYLE[issue.tier].box,
                                )}
                            >
                                <Icon className="mt-px size-3.5 shrink-0" />
                                <span className="min-w-0 [overflow-wrap:anywhere]">
                                    <span className="font-semibold">{TIER_STYLE[issue.tier].label}: </span>
                                    {label && `${label}. `}
                                    {issue.message}
                                </span>
                            </p>
                        );
                    })}
                </section>
            )}

            {type && type.parties.length > 0 && (
                <Card className="overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-4">
                        <Users className="size-4 text-muted-foreground" />
                        <h3 className="text-base font-semibold">Parties</h3>
                    </div>
                    <div className="flex flex-col gap-4 border-t px-5 py-5">
                        {layout.roles.map(({ role, parties }) => {
                            if (parties.length === 0) {
                                return (
                                    <p key={role.role} className="text-sm text-muted-foreground italic">
                                        No {role.role} recorded.
                                    </p>
                                );
                            }
                            return parties.map(({ party, before, groups }) => (
                                <div key={party.id} className="rounded-lg border bg-muted/20 p-4">
                                    <div className="mb-3 flex items-center gap-2">
                                        <span className="text-sm font-semibold">
                                            {partyName(values.parties, party)}
                                        </span>
                                        <Badge variant={role.internal ? "default" : "muted"}>
                                            {role.internal ? "iBUS side" : "Counterparty"}
                                        </Badge>
                                        {compareTo && !before && (
                                            <Badge className="border border-amber-200 bg-amber-50 text-amber-700">
                                                added
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-4">
                                        {groups.map((group) => (
                                            <div key={group.section} className="flex flex-col gap-2">
                                                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                                    {group.section}
                                                </p>
                                                <div className={GRID}>
                                                    {group.fields.map((f) => (
                                                        <ViewField
                                                            key={f.key}
                                                            field={f}
                                                            value={party.values[f.key]}
                                                            scope={party.values}
                                                            derive={derive}
                                                            issues={issuesFor(shownIssues, f.key, party.id)}
                                                            showEmpty={showEmpty}
                                                            compare={!!compareTo && !!before}
                                                            previous={before?.values[f.key]}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ));
                        })}
                        {removedParties.length > 0 && (
                            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                                Removed since the earlier version:{" "}
                                {removedParties.map((p) => partyName(compareTo?.parties ?? [], p)).join(", ")}
                            </p>
                        )}
                    </div>
                </Card>
            )}

            {layout.docGroups.map((group) => (
                <Card key={group.section} className="overflow-hidden">
                    <div className="px-5 py-4">
                        <h3 className="text-base font-semibold">{group.section}</h3>
                    </div>
                    <div className={cn(GRID, "border-t px-5 py-5")}>
                        {group.fields.map((f) => (
                            <ViewField
                                key={f.key}
                                field={f}
                                value={values.fields[f.key]}
                                scope={values.fields}
                                derive={derive}
                                issues={issuesFor(shownIssues, f.key)}
                                showEmpty={showEmpty}
                                compare={!!compareTo}
                                previous={compareTo?.fields[f.key]}
                            />
                        ))}
                    </div>
                </Card>
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------------------------------------------

function ViewField({
    field,
    value,
    scope,
    derive,
    issues,
    showEmpty,
    compare,
    previous,
}: {
    field: FieldDef;
    value: FieldValue | undefined;
    scope: Record<string, FieldValue>;
    derive: DeriveContext;
    issues: Issue[];
    showEmpty: boolean;
    compare: boolean;
    previous: FieldValue | undefined;
}) {
    const { derived, derivedText, empty, required, changed, shown } = fieldState(
        field,
        value,
        scope,
        derive,
        showEmpty,
        compare,
        previous,
    );
    if (!shown) return null;

    const wasText = isEmpty(previous)
        ? "empty"
        : isNotStated(previous)
          ? NOT_STATED_LABEL
          : formatValue(field, previous);

    let body;
    if (derived) {
        body = derivedText ? <span>{derivedText}</span> : <span className="text-muted-foreground">-</span>;
    } else if (isNotStated(value)) {
        body = (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                {NOT_STATED_LABEL}
            </span>
        );
    } else if (empty) {
        body = required ? (
            <span className="text-destructive italic">Not entered</span>
        ) : (
            <span className="text-muted-foreground">-</span>
        );
    } else {
        body = <ValueDisplay field={field} value={value as FieldValue} />;
    }

    return (
        <div
            className={cn(
                "flex min-w-0 flex-col gap-1 rounded-md border px-3 py-2",
                isLongType(field.type) && "md:col-span-2",
                changed ? "border-amber-200 bg-amber-50/70" : "border-transparent bg-muted/30",
            )}
        >
            <div className="flex items-center gap-2">
                <span className="min-w-0 text-xs font-medium [overflow-wrap:anywhere] text-muted-foreground">
                    {field.label}
                </span>
                <LevelPill level={field.level} />
                {derived && (
                    <Badge variant="muted" className="px-1.5 py-px text-[10px]">
                        Derived
                    </Badge>
                )}
                {changed && (
                    <Badge className="border border-amber-200 bg-amber-100 px-1.5 py-px text-[10px] text-amber-800">
                        changed
                    </Badge>
                )}
            </div>
            <div className="text-sm [overflow-wrap:anywhere]">{body}</div>
            {changed && <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">Was: {wasText}</p>}
            {issues.map((issue, i) => {
                const Icon = TIER_STYLE[issue.tier].icon;
                return (
                    <p key={i} className={cn("flex items-start gap-1.5 text-xs", TIER_STYLE[issue.tier].text)}>
                        <Icon className="mt-px size-3.5 shrink-0" />
                        {issue.message}
                    </p>
                );
            })}
        </div>
    );
}

// ---------------------------------------------------------------------------------------------------------------

function cellText(column: TableColumn | undefined, raw: string | undefined): string {
    const text = raw ?? "";
    if (!text) return "";
    if (column?.type === "date") return formatDate(text);
    if (column?.type === "percent") return `${text} %`;
    return text;
}

function ValueDisplay({ field, value }: { field: FieldDef; value: FieldValue }) {
    switch (field.type) {
        case "longtext":
        case "formula":
            return <span className="whitespace-pre-wrap">{String(value)}</span>;
        case "person_list":
            return (
                <ul className="flex flex-col gap-0.5">
                    {(value as PersonValue[]).map((p, i) => (
                        <li key={i}>{[p.name, p.designation].filter(Boolean).join(", ")}</li>
                    ))}
                </ul>
            );
        case "contact_list":
            return (
                <ul className="flex flex-col gap-0.5">
                    {(value as ContactValue[]).map((c, i) => (
                        <li key={i}>{[c.name, c.role, c.email, c.phone].filter(Boolean).join(", ")}</li>
                    ))}
                </ul>
            );
        case "table": {
            const rows = value as Record<string, string>[];
            const columns: TableColumn[] =
                field.columns ?? Object.keys(rows[0] ?? {}).map((key) => ({ key, label: key, type: "text" as const }));
            return (
                <div className="max-w-full overflow-x-auto rounded-md border bg-card">
                    <Table className="text-xs">
                        <TableHeader>
                            <TableRow>
                                {columns.map((c) => (
                                    <TableHead key={c.key} className="h-8 px-3">
                                        {c.label}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row, i) => (
                                <TableRow key={i}>
                                    {columns.map((c) => (
                                        <TableCell key={c.key} className="px-3 py-2">
                                            {cellText(c, row[c.key])}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            );
        }
        default:
            return <span>{formatValue(field, value)}</span>;
    }
}
