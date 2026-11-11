import { useMemo } from "react";

import { cn } from "@/lib/utils";

import {
    composeFields,
    deriveValue,
    formatDate,
    formatValue,
    isEmpty,
    isNotStated,
    isRequired,
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
    PersonValue,
    TableColumn,
} from "./model";
import { documentSections, partiesOfRole, partyName, partySections } from "./templateLayout";

export interface SummarySheetProps {
    library: FieldLibrary;
    typeCode: string;
    title: string;
    values: DocumentValues;
    derive: DeriveContext;
    versionNo: number;
    /** Version content hash printed at the foot of the sheet. */
    hash: string;
    submittedBy: string;
    submittedAt: string;
    /** Reference line when the document was created from an invalid one. */
    createdFrom?: string;
    /** FLAG issues are printed for the signer. */
    flags: Issue[];
}

/** Rows that fit on one printed page. */
const PAGE_ROWS = 34;
/** Characters that fit on one line of the value column. */
const VALUE_CHARS = 62;
/** Characters that fit on one line of the label column (it is 36% of the row, the value column the rest). */
const LABEL_CHARS = 32;
/** Characters that fit across the full width of a table inside the value column (its text is 10px). */
const TABLE_CHARS = 64;
/** Extra rows a table takes for its borders and spacing. */
const TABLE_SLACK = 1;

type Item =
    | { kind: "title"; weight: number }
    | { kind: "heading"; text: string; level: 1 | 2; continued?: boolean; weight: number }
    | {
          kind: "row";
          label: string;
          field?: FieldDef;
          value?: FieldValue;
          text: string;
          state: "value" | "notStated" | "missing";
          weight: number;
          /** Tables only: printed lines of the header row and of each body row, so a long table can be split. */
          headWeight?: number;
          rowWeights?: number[];
      }
    | { kind: "flag"; label?: string; text: string; weight: number }
    | { kind: "footer"; weight: number };

type RowItem = Extract<Item, { kind: "row" }>;

const lines = (text: string, width = VALUE_CHARS) =>
    text.split("\n").reduce((n, line) => n + Math.max(1, Math.ceil(line.length / width)), 0);

const personText = (p: PersonValue) => [p.name, p.designation].filter(Boolean).join(", ");
const contactText = (c: ContactValue) => [c.name, c.role, c.email, c.phone].filter(Boolean).join(", ");

function tableColumns(field: FieldDef, rows: Record<string, string>[]): TableColumn[] {
    return field.columns ?? Object.keys(rows[0] ?? {}).map((key) => ({ key, label: key, type: "text" as const }));
}

const cellText = (c: TableColumn, raw: string | undefined) =>
    c.type === "date" && raw ? formatDate(raw) : (raw ?? "");

/** Printed lines of a table's header and of each body row, from how its cells wrap. */
function tableWeights(columns: TableColumn[], rows: Record<string, string>[]) {
    const width = Math.max(3, Math.floor(TABLE_CHARS / Math.max(1, columns.length)) - 3);
    const rowLines = (cells: string[]) => Math.max(1, ...cells.map((c) => lines(c, width)));
    return {
        headWeight: rowLines(columns.map((c) => c.label)),
        rowWeights: rows.map((row) => rowLines(columns.map((c) => cellText(c, row[c.key])))),
    };
}

const tableWeight = (headWeight: number, rowWeights: number[]) =>
    headWeight + rowWeights.reduce((a, b) => a + b, 0) + TABLE_SLACK;

/** A row is as tall as its label or its value, whichever wraps to more lines. */
const heightOf = (label: string, valueLines: number) => Math.max(lines(label, LABEL_CHARS), valueLines);

function rowFor(
    field: FieldDef,
    value: FieldValue | undefined,
    scope: Record<string, FieldValue>,
    derive: DeriveContext,
): Item | null {
    const label = field.label;
    if (field.req === "D") {
        const text = deriveValue(field, derive, scope);
        return text ? { kind: "row", label, text, state: "value", weight: heightOf(label, lines(text)) } : null;
    }
    if (isNotStated(value)) {
        return { kind: "row", label, text: NOT_STATED_LABEL, state: "notStated", weight: heightOf(label, 1) };
    }
    if (isEmpty(value)) {
        if (!isRequired(field, scope)) return null;
        return { kind: "row", label, text: "Not entered", state: "missing", weight: heightOf(label, 1) };
    }
    const text = formatValue(field, value);
    if (field.type === "table") {
        const rows = value as Record<string, string>[];
        const { headWeight, rowWeights } = tableWeights(tableColumns(field, rows), rows);
        const weight = heightOf(label, tableWeight(headWeight, rowWeights));
        return { kind: "row", label, field, value, text, state: "value", weight, headWeight, rowWeights };
    }
    let valueLines = lines(text);
    if (field.type === "person_list") {
        valueLines = (value as PersonValue[]).reduce((n, p) => n + lines(personText(p)), 0);
    } else if (field.type === "contact_list") {
        valueLines = (value as ContactValue[]).reduce((n, c) => n + lines(contactText(c)), 0);
    }
    return { kind: "row", label, field, value, text, state: "value", weight: heightOf(label, Math.max(1, valueLines)) };
}

function buildItems(
    library: FieldLibrary,
    typeCode: string,
    values: DocumentValues,
    derive: DeriveContext,
    flags: Issue[],
): Item[] {
    const type = library.documentTypes.find((t) => t.code === typeCode);
    const composed = composeFields(library, typeCode, values.custom);
    const items: Item[] = [{ kind: "title", weight: 8 }];

    const partyItems: Item[] = [];
    for (const role of type?.parties ?? []) {
        for (const party of partiesOfRole(values.parties, role.role)) {
            const rows = partySections(composed, role, party.values)
                .flatMap((g) => g.fields)
                .map((f) => rowFor(f, party.values[f.key], party.values, derive))
                .filter((r): r is Item => r !== null);
            if (rows.length === 0) continue;
            partyItems.push(
                { kind: "heading", text: partyName(values.parties, party), level: 2, weight: 1.5 },
                ...rows,
            );
        }
    }
    if (partyItems.length > 0) items.push({ kind: "heading", text: "Parties", level: 1, weight: 2 }, ...partyItems);

    for (const group of documentSections(composed, values.fields)) {
        const rows = group.fields
            .map((f) => rowFor(f, values.fields[f.key], values.fields, derive))
            .filter((r): r is Item => r !== null);
        if (rows.length === 0) continue;
        items.push({ kind: "heading", text: group.section, level: 1, weight: 2 }, ...rows);
    }

    if (flags.length > 0) {
        items.push({ kind: "heading", text: "Points for the signer", level: 1, weight: 2 });
        for (const flag of flags) {
            const label = flag.fieldKey ? composed.find((f) => f.key === flag.fieldKey)?.label : undefined;
            items.push({ kind: "flag", label, text: flag.message, weight: lines(`${label ?? ""} ${flag.message}`) });
        }
    }

    items.push({ kind: "footer", weight: 9 });
    return items;
}

/** A table row that can be cut between two of its body rows. */
const isSplittable = (item: Item): item is RowItem & { value: Record<string, string>[]; rowWeights: number[] } =>
    item.kind === "row" && item.field?.type === "table" && !!item.rowWeights && item.rowWeights.length > 1;

/** The least room an item needs: a splittable table only needs its header and first row. */
const minWeight = (item: Item) =>
    isSplittable(item) ? Math.min(item.weight, (item.headWeight ?? 1) + item.rowWeights[0] + TABLE_SLACK) : item.weight;

/**
 * Cuts a table so its first part fits in `room` lines (at least one body row). Returns the rest, or undefined when
 * everything fits.
 */
function splitTable(item: RowItem & { value: Record<string, string>[]; rowWeights: number[] }, room: number) {
    const head = item.headWeight ?? 1;
    let count = 0;
    let used = head + TABLE_SLACK;
    while (count < item.rowWeights.length && (count === 0 || used + item.rowWeights[count] <= room)) {
        used += item.rowWeights[count];
        count += 1;
    }
    if (count >= item.rowWeights.length) return { first: item, rest: undefined };
    const part = (from: number, to: number, label: string): RowItem => {
        const rowWeights = item.rowWeights.slice(from, to);
        return {
            ...item,
            label,
            value: item.value.slice(from, to),
            rowWeights,
            weight: tableWeight(head, rowWeights),
        };
    };
    const base = item.label.replace(/ \(continued\)$/, "");
    return {
        first: part(0, count, item.label),
        rest: part(count, item.rowWeights.length, `${base} (continued)`),
    };
}

/**
 * Fills pages up to the row budget. A heading never ends a page and a row is never split, except a table longer than
 * the room left, which continues on the next page row by row.
 */
function paginate(items: Item[]): Item[][] {
    const queue = [...items];
    const pages: Item[][] = [[]];
    let used = 0;
    let context: Extract<Item, { kind: "heading" }> | undefined;

    for (let i = 0; i < queue.length; i++) {
        let item = queue[i];
        let need = minWeight(item);
        if (item.kind === "heading") {
            for (let j = i + 1; j < queue.length; j++) {
                need += minWeight(queue[j]);
                if (queue[j].kind !== "heading") break;
            }
        }
        if (used > 0 && used + need > PAGE_ROWS) {
            pages.push([]);
            used = 0;
            if ((item.kind === "row" || item.kind === "flag") && context) {
                pages[pages.length - 1].push({ ...context, continued: true });
                used += context.weight;
            }
        }
        if (isSplittable(item) && used + item.weight > PAGE_ROWS) {
            const { first, rest } = splitTable(item, PAGE_ROWS - used);
            if (rest) {
                item = first;
                queue.splice(i + 1, 0, rest);
            }
        }
        pages[pages.length - 1].push(item);
        used += item.weight;
        if (item.kind === "heading") context = item;
    }
    return pages;
}

function formatIst(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const text = d.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
    return `${text.replace(/\s(am|pm)$/i, (m) => m.toLowerCase())} IST`;
}

export function SummarySheet(props: SummarySheetProps) {
    const { library, typeCode, title, values, derive, flags, versionNo, hash, submittedBy, submittedAt, createdFrom } =
        props;
    const type = library.documentTypes.find((t) => t.code === typeCode);
    const pages = useMemo(
        () => paginate(buildItems(library, typeCode, values, derive, flags)),
        [library, typeCode, values, derive, flags],
    );

    return (
        <div className="flex flex-col gap-6">
            {pages.map((page, pageIndex) => (
                <section
                    key={pageIndex}
                    aria-label={`Summary Reference Sheet page ${pageIndex + 1} of ${pages.length}`}
                    className="mx-auto flex aspect-[210/297] w-full max-w-2xl flex-col bg-white px-10 py-9 text-[11px] leading-snug text-neutral-900 shadow-md ring-1 ring-black/5"
                >
                    <div className="flex flex-1 flex-col">
                        {page.map((item, i) => {
                            switch (item.kind) {
                                case "title":
                                    return (
                                        <div key={i} className="mb-4 border-b-2 border-neutral-900 pb-3">
                                            <p className="text-[10px] font-semibold tracking-[0.18em] text-neutral-500 uppercase">
                                                Summary Reference Sheet
                                            </p>
                                            <h1 className="mt-1 font-serif text-xl leading-tight font-bold">{title}</h1>
                                            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
                                                <dt className="text-neutral-500">Document type</dt>
                                                <dd className="font-medium">
                                                    <span className="font-mono">{typeCode}</span>
                                                    {type ? `, ${type.name}` : ""}
                                                </dd>
                                                {derive.instanceId && (
                                                    <>
                                                        <dt className="text-neutral-500">Instance ID</dt>
                                                        <dd className="font-mono font-medium">{derive.instanceId}</dd>
                                                    </>
                                                )}
                                                <dt className="text-neutral-500">Version</dt>
                                                <dd className="font-medium">{versionNo}</dd>
                                            </dl>
                                        </div>
                                    );
                                case "heading":
                                    return (
                                        <h2
                                            key={i}
                                            className={cn(
                                                item.level === 1
                                                    ? "mt-3 mb-1 border-b border-neutral-900 pb-0.5 font-serif text-[13px] font-bold"
                                                    : "mt-2 mb-0.5 text-[11px] font-bold text-neutral-700",
                                            )}
                                        >
                                            {item.text}
                                            {item.continued && (
                                                <span className="ml-1 font-sans text-[10px] font-normal text-neutral-500">
                                                    (continued)
                                                </span>
                                            )}
                                        </h2>
                                    );
                                case "row":
                                    return (
                                        <div
                                            key={i}
                                            className="grid grid-cols-[36%_1fr] gap-3 border-b border-neutral-200 py-0.5"
                                        >
                                            <div className="text-neutral-600">{item.label}</div>
                                            <div
                                                className={cn(
                                                    "min-w-0 break-words",
                                                    item.state === "notStated" && "font-bold",
                                                    item.state === "missing" && "text-neutral-500 italic",
                                                    item.state === "value" && "font-medium",
                                                )}
                                            >
                                                <RowValue item={item} />
                                            </div>
                                        </div>
                                    );
                                case "flag":
                                    return (
                                        <p key={i} className="flex gap-2 border-b border-neutral-200 py-0.5">
                                            <span aria-hidden>-</span>
                                            <span>
                                                {item.label && <span className="font-semibold">{item.label}: </span>}
                                                {item.text}
                                            </span>
                                        </p>
                                    );
                                case "footer":
                                    return (
                                        <div key={i} className="mt-auto border-t-2 border-neutral-900 pt-2">
                                            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
                                                <dt className="text-neutral-500">Submitted by</dt>
                                                <dd className="font-medium">{submittedBy}</dd>
                                                <dt className="text-neutral-500">Submitted at</dt>
                                                <dd className="font-medium">{formatIst(submittedAt)}</dd>
                                                {createdFrom && (
                                                    <>
                                                        <dt className="text-neutral-500">Created from</dt>
                                                        <dd className="font-medium">{createdFrom}</dd>
                                                    </>
                                                )}
                                                <dt className="text-neutral-500">Version content hash (SHA-256)</dt>
                                                <dd className="font-mono text-[10px] break-all">{hash}</dd>
                                            </dl>
                                        </div>
                                    );
                            }
                        })}
                    </div>
                    <p className="mt-4 border-t border-neutral-300 pt-2 text-center text-[10px] text-neutral-500">
                        Summary Reference Sheet · version {versionNo} · page {pageIndex + 1} of {pages.length}
                    </p>
                </section>
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------------------------------------------

function RowValue({ item }: { item: Extract<Item, { kind: "row" }> }) {
    const { field, value } = item;
    if (!field || value === undefined) return <>{item.text}</>;
    if (field.type === "person_list") {
        return (
            <>
                {(value as PersonValue[]).map((p, i) => (
                    <div key={i}>{personText(p)}</div>
                ))}
            </>
        );
    }
    if (field.type === "contact_list") {
        return (
            <>
                {(value as ContactValue[]).map((c, i) => (
                    <div key={i}>{contactText(c)}</div>
                ))}
            </>
        );
    }
    if (field.type === "table") {
        const rows = value as Record<string, string>[];
        const columns = tableColumns(field, rows);
        return (
            <table className="w-full border-collapse text-[10px]">
                <thead>
                    <tr>
                        {columns.map((c) => (
                            <th
                                key={c.key}
                                className="border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 text-left font-semibold"
                            >
                                {c.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i}>
                            {columns.map((c) => (
                                <td key={c.key} className="border border-neutral-300 px-1.5 py-0.5 font-normal">
                                    {cellText(c, row[c.key])}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }
    return <span className={field.type === "longtext" ? "whitespace-pre-wrap" : undefined}>{item.text}</span>;
}
