// Add/remove inputs: person_list, contact_list, table and date_list. The value is the list itself (a row exists
// because it is in the array, even if blank), an emptied list reports `undefined`, and rows keep a stable React key
// so removing one does not move focus or typed text onto its neighbour.
import type * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
    asContactList,
    asDateList,
    asPersonList,
    asRows,
    blankRow,
    cellInput,
    nextList,
    removeAt,
    replaceAt,
    todayIso,
} from "./helpers";
import {
    AddButton,
    EmptyList,
    RemoveButton,
    SubField,
    WithSuffix,
    controlAria,
    useRowKeys,
    type ControlProps,
} from "./shared";

/** Id of a control inside row `index`. The very first control of the list takes the field's own id. */
const rowId = (baseId: string, keys: string[], index: number, part: string) =>
    index === 0 && part === "first" ? baseId : `${baseId}-${keys[index]}-${part}`;

// ---------------------------------------------------------------------------------------------------------------
// person_list
// ---------------------------------------------------------------------------------------------------------------

export function PersonListControl({ field, value, onChange, shared }: ControlProps) {
    const rows = asPersonList(value);
    const { keys, rootRef, noteAdded, noteRemoved } = useRowKeys(rows.length);
    const label = field.label;

    return (
        <div
            ref={rootRef}
            // Never on the Add button: a click on the field's <label htmlFor> would press it.
            id={rows.length === 0 ? shared.id : undefined}
            role="group"
            aria-label={label}
            aria-describedby={shared.describedBy}
            className="flex flex-col gap-2"
        >
            {rows.length === 0 && <EmptyList>No one added yet.</EmptyList>}
            {rows.map((person, i) => (
                <div
                    key={keys[i]}
                    data-row={keys[i]}
                    className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center sm:border-0 sm:p-0"
                >
                    <Input
                        {...controlAria(
                            shared,
                            rowId(shared.id, keys, i, "first"),
                            `${label}, person ${i + 1} name`,
                            false,
                        )}
                        type="text"
                        autoComplete="off"
                        placeholder="Name"
                        value={person.name}
                        onChange={(e) => onChange(nextList(replaceAt(rows, i, { ...person, name: e.target.value })))}
                    />
                    <Input
                        {...controlAria(
                            shared,
                            rowId(shared.id, keys, i, "designation"),
                            `${label}, person ${i + 1} designation`,
                            false,
                        )}
                        type="text"
                        autoComplete="off"
                        placeholder="Designation"
                        value={person.designation}
                        onChange={(e) =>
                            onChange(nextList(replaceAt(rows, i, { ...person, designation: e.target.value })))
                        }
                    />
                    <RemoveButton
                        label={`Remove person ${i + 1}`}
                        disabled={shared.disabled}
                        className="justify-self-end"
                        onClick={() => {
                            noteRemoved(i);
                            onChange(nextList(removeAt(rows, i)));
                        }}
                    />
                </div>
            ))}
            <AddButton
                label="Add person"
                disabled={shared.disabled}
                onClick={() => {
                    noteAdded();
                    onChange(nextList([...rows, { name: "", designation: "" }]));
                }}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------------------------------------------
// contact_list
// ---------------------------------------------------------------------------------------------------------------

export function ContactListControl({ field, value, onChange, shared }: ControlProps) {
    const rows = asContactList(value);
    const { keys, rootRef, noteAdded, noteRemoved } = useRowKeys(rows.length);
    const label = field.label;

    const parts = [
        { key: "name", label: "Name", type: "text", inputMode: undefined },
        { key: "role", label: "Role", type: "text", inputMode: undefined },
        { key: "email", label: "Email", type: "email", inputMode: "email" },
        { key: "phone", label: "Phone", type: "tel", inputMode: "tel" },
    ] as const;

    return (
        <div
            ref={rootRef}
            // Never on the Add button: a click on the field's <label htmlFor> would press it.
            id={rows.length === 0 ? shared.id : undefined}
            role="group"
            aria-label={label}
            aria-describedby={shared.describedBy}
            className="flex flex-col gap-3"
        >
            {rows.length === 0 && <EmptyList>No contacts added yet.</EmptyList>}
            {rows.map((contact, i) => (
                <div key={keys[i]} data-row={keys[i]} className="rounded-md border p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Contact {i + 1}</span>
                        <RemoveButton
                            label={`Remove contact ${i + 1}`}
                            disabled={shared.disabled}
                            onClick={() => {
                                noteRemoved(i);
                                onChange(nextList(removeAt(rows, i)));
                            }}
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {parts.map((part) => {
                            const id = rowId(shared.id, keys, i, part.key === "name" ? "first" : part.key);
                            return (
                                <SubField key={part.key} label={part.label} htmlFor={id}>
                                    <Input
                                        {...controlAria(
                                            shared,
                                            id,
                                            `${label}, contact ${i + 1} ${part.label.toLowerCase()}`,
                                            false,
                                        )}
                                        type={part.type}
                                        inputMode={part.inputMode}
                                        autoComplete="off"
                                        value={contact[part.key]}
                                        onChange={(e) =>
                                            onChange(
                                                nextList(
                                                    replaceAt(rows, i, { ...contact, [part.key]: e.target.value }),
                                                ),
                                            )
                                        }
                                    />
                                </SubField>
                            );
                        })}
                    </div>
                </div>
            ))}
            <AddButton
                label="Add contact"
                disabled={shared.disabled}
                onClick={() => {
                    noteAdded();
                    onChange(nextList([...rows, { name: "", role: "", email: "", phone: "" }]));
                }}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------------------------------------------
// table
// ---------------------------------------------------------------------------------------------------------------

// Written out in full so Tailwind sees every class. Up to three columns sit side by side from the `sm` breakpoint;
// more than that stay stacked as labelled cards until `lg`, so the control never overflows a narrow screen.
const TABLE_LAYOUT = {
    narrow: {
        template: "sm:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))_2.25rem]",
        header: "sm:grid",
        row: "sm:items-center sm:border-0 sm:p-0",
        cellLabel: "sm:hidden",
    },
    wide: {
        template: "lg:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))_2.25rem]",
        header: "lg:grid",
        row: "lg:items-center lg:border-0 lg:p-0",
        cellLabel: "lg:hidden",
    },
} as const;

export function TableControl({ field, value, onChange, shared }: ControlProps) {
    const columns = field.columns ?? [];
    const rows = asRows(value, columns);
    const { keys, rootRef, noteAdded, noteRemoved } = useRowKeys(rows.length);
    const layout = columns.length > 3 ? TABLE_LAYOUT.wide : TABLE_LAYOUT.narrow;
    const vars = { "--cols": columns.length } as React.CSSProperties;

    if (columns.length === 0) return <EmptyList>This table has no columns defined.</EmptyList>;

    return (
        <div
            ref={rootRef}
            // Never on the Add button: a click on the field's <label htmlFor> would press it.
            id={rows.length === 0 ? shared.id : undefined}
            role="group"
            aria-label={field.label}
            aria-describedby={shared.describedBy}
            className="flex flex-col gap-2"
        >
            {rows.length > 0 && (
                <div
                    aria-hidden
                    style={vars}
                    className={cn(
                        "hidden gap-2 text-xs font-medium text-muted-foreground",
                        layout.header,
                        layout.template,
                    )}
                >
                    {columns.map((c) => (
                        <span key={c.key} className="min-w-0 truncate">
                            {c.label}
                        </span>
                    ))}
                    <span />
                </div>
            )}
            {rows.length === 0 && <EmptyList>No rows added yet.</EmptyList>}
            {rows.map((row, i) => (
                <div
                    key={keys[i]}
                    data-row={keys[i]}
                    style={vars}
                    className={cn("grid grid-cols-1 gap-2 rounded-md border p-3", layout.row, layout.template)}
                >
                    {columns.map((col, c) => {
                        const cell = cellInput(col.type);
                        const input = (
                            <Input
                                {...controlAria(
                                    shared,
                                    rowId(shared.id, keys, i, i === 0 && c === 0 ? "first" : col.key),
                                    `${field.label}, row ${i + 1}, ${col.label}`,
                                    false,
                                )}
                                type={cell.type}
                                inputMode={cell.inputMode}
                                autoComplete="off"
                                className={cell.suffix ? "pr-8" : undefined}
                                value={row[col.key]}
                                onChange={(e) =>
                                    onChange(nextList(replaceAt(rows, i, { ...row, [col.key]: e.target.value })))
                                }
                            />
                        );
                        return (
                            <div key={col.key} className="flex min-w-0 flex-col gap-1">
                                <span
                                    aria-hidden
                                    className={cn("text-xs font-medium text-muted-foreground", layout.cellLabel)}
                                >
                                    {col.label}
                                </span>
                                {cell.suffix ? <WithSuffix suffix={cell.suffix}>{input}</WithSuffix> : input}
                            </div>
                        );
                    })}
                    <RemoveButton
                        label={`Remove row ${i + 1}`}
                        disabled={shared.disabled}
                        className="justify-self-end"
                        onClick={() => {
                            noteRemoved(i);
                            onChange(nextList(removeAt(rows, i)));
                        }}
                    />
                </div>
            ))}
            <AddButton
                label="Add row"
                disabled={shared.disabled}
                onClick={() => {
                    noteAdded();
                    onChange(nextList([...rows, blankRow(columns)]));
                }}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------------------------------------------
// date_list
// ---------------------------------------------------------------------------------------------------------------

export function DateListControl({ field, value, onChange, shared }: ControlProps) {
    const rows = asDateList(value);
    const { keys, rootRef, noteAdded, noteRemoved } = useRowKeys(rows.length);

    return (
        <div
            ref={rootRef}
            // Never on the Add button: a click on the field's <label htmlFor> would press it.
            id={rows.length === 0 ? shared.id : undefined}
            role="group"
            aria-label={field.label}
            aria-describedby={shared.describedBy}
            className="flex flex-col gap-2"
        >
            {rows.length === 0 && <EmptyList>No dates added yet.</EmptyList>}
            {rows.map((date, i) => (
                <div key={keys[i]} data-row={keys[i]} className="flex items-center gap-2">
                    <Input
                        {...controlAria(
                            shared,
                            rowId(shared.id, keys, i, "first"),
                            `${field.label}, date ${i + 1}`,
                            false,
                        )}
                        type="date"
                        className="min-w-0 flex-1 sm:max-w-56 sm:flex-none"
                        max={field.notInFuture ? todayIso() : undefined}
                        value={date}
                        onChange={(e) => onChange(nextList(replaceAt(rows, i, e.target.value)))}
                    />
                    <RemoveButton
                        label={`Remove date ${i + 1}`}
                        disabled={shared.disabled}
                        onClick={() => {
                            noteRemoved(i);
                            onChange(nextList(removeAt(rows, i)));
                        }}
                    />
                </div>
            ))}
            <AddButton
                label="Add date"
                disabled={shared.disabled}
                onClick={() => {
                    noteAdded();
                    onChange(nextList([...rows, ""]));
                }}
            />
        </div>
    );
}
