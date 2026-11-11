// Pure helpers for the field inputs: type guards over the loosely-typed FieldValue union, "compaction" of
// composite values (so a cleared control reports `undefined`), and small list utilities. No React in here.
import type {
    AddressValue,
    ContactValue,
    DurationUnit,
    DurationValue,
    FieldDef,
    FieldValue,
    MoneyValue,
    PersonValue,
    TableColumn,
} from "../model";

export const DEFAULT_COUNTRY = "India";
export const DEFAULT_CURRENCY = "INR";

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown) => (typeof v === "string" ? v : "");

// ---------------------------------------------------------------------------------------------------------------
// Reading values defensively. The library is pasted JSON, so a stored value can be of an older or wrong shape;
// the inputs must still render it instead of throwing.
// ---------------------------------------------------------------------------------------------------------------

export const asText = (v: FieldValue | undefined): string => (typeof v === "string" ? v : "");

export function asMoney(v: FieldValue | undefined, defaultCurrency: string): MoneyValue {
    if (typeof v === "string") return { amount: v, currency: defaultCurrency };
    if (isPlainObject(v) && "amount" in v) {
        const period = str(v.period);
        return { amount: str(v.amount), currency: str(v.currency) || defaultCurrency, ...(period ? { period } : {}) };
    }
    return { amount: "", currency: defaultCurrency };
}

export function asDuration(v: FieldValue | undefined): { value: string; unit: DurationUnit | "" } {
    if (isPlainObject(v) && "value" in v && "unit" in v)
        return { value: str(v.value), unit: str(v.unit) as DurationUnit | "" };
    return { value: "", unit: "" };
}

export function asAddress(v: FieldValue | undefined): Required<AddressValue> {
    const a: Record<string, unknown> = isPlainObject(v) && "line1" in v ? v : {};
    return {
        line1: str(a.line1),
        line2: str(a.line2),
        city: str(a.city),
        state: str(a.state),
        pin: str(a.pin),
        // A value that was never given a country is an Indian address; an explicitly cleared one stays cleared.
        country: "country" in a ? str(a.country) : DEFAULT_COUNTRY,
    };
}

export function asPerson(v: FieldValue | undefined): PersonValue {
    const p: Record<string, unknown> = isPlainObject(v) && "name" in v ? v : {};
    return { name: str(p.name), designation: str(p.designation) };
}

export function asPersonList(v: FieldValue | undefined): PersonValue[] {
    return Array.isArray(v) ? (v as unknown[]).map((p) => asPerson(p as FieldValue)) : [];
}

export function asContactList(v: FieldValue | undefined): ContactValue[] {
    if (!Array.isArray(v)) return [];
    return (v as unknown[]).map((c) => {
        const o = isPlainObject(c) ? c : {};
        return { name: str(o.name), role: str(o.role), email: str(o.email), phone: str(o.phone) };
    });
}

export function asRows(v: FieldValue | undefined, columns: TableColumn[]): Record<string, string>[] {
    if (!Array.isArray(v)) return [];
    return (v as unknown[]).map((r) => {
        const o = isPlainObject(r) ? r : {};
        // Keep any keys the stored row has beyond the current columns so editing never drops data.
        const row: Record<string, string> = {};
        for (const [k, x] of Object.entries(o)) row[k] = str(x);
        for (const c of columns) row[c.key] = str(o[c.key]);
        return row;
    });
}

export const asDateList = (v: FieldValue | undefined): string[] => (Array.isArray(v) ? (v as unknown[]).map(str) : []);

// ---------------------------------------------------------------------------------------------------------------
// Producing values. Each `next*` returns the value to emit, or `undefined` when the control is cleared.
// ---------------------------------------------------------------------------------------------------------------

export const nextText = (s: string): FieldValue | undefined => (s === "" ? undefined : s);

export function nextMoney(
    current: MoneyValue,
    patch: Partial<MoneyValue>,
    defaultCurrency: string,
): FieldValue | undefined {
    const merged = { ...current, ...patch };
    const period = merged.period || undefined;
    if (merged.amount === "" && !period && (merged.currency === defaultCurrency || !merged.currency)) return undefined;
    return { amount: merged.amount, currency: merged.currency || defaultCurrency, ...(period ? { period } : {}) };
}

/**
 * The unit is an explicit choice, so a number typed before a unit is chosen is kept with `unit: ""`. The cast is the
 * only place the contract's `DurationUnit` is widened; the engine reports "Choose the unit" for it.
 */
export function nextDuration(
    current: { value: string; unit: DurationUnit | "" },
    patch: Partial<{ value: string; unit: DurationUnit | "" }>,
): FieldValue | undefined {
    const merged = { ...current, ...patch };
    if (merged.value === "" && merged.unit === "") return undefined;
    return { value: merged.value, unit: merged.unit as DurationUnit } satisfies DurationValue;
}

export function nextAddress(current: Required<AddressValue>, patch: Partial<AddressValue>): FieldValue | undefined {
    const merged = { ...current, ...patch };
    // Text is never trimmed while typing, so only strictly empty parts count as cleared. The default country alone
    // is not an answer. A country the user emptied is kept (as `country: ""`) so the box does not snap back.
    const cleared =
        merged.line1 === "" &&
        merged.line2 === "" &&
        merged.city === "" &&
        merged.state === "" &&
        merged.pin === "" &&
        merged.country === DEFAULT_COUNTRY;
    return cleared ? undefined : { ...merged };
}

export function nextPerson(current: PersonValue, patch: Partial<PersonValue>): FieldValue | undefined {
    const merged = { ...current, ...patch };
    if (merged.name === "" && merged.designation === "") return undefined;
    return merged;
}

/** An emptied list reports `undefined`; a list with an (even blank) row is a value. */
export function nextList(
    rows: PersonValue[] | ContactValue[] | Record<string, string>[] | string[],
): FieldValue | undefined {
    return rows.length === 0 ? undefined : rows;
}

export const replaceAt = <T>(list: readonly T[], index: number, item: T): T[] =>
    list.map((x, i) => (i === index ? item : x));

export const removeAt = <T>(list: readonly T[], index: number): T[] => list.filter((_, i) => i !== index);

export const blankRow = (columns: TableColumn[]): Record<string, string> =>
    Object.fromEntries(columns.map((c) => [c.key, ""]));

// ---------------------------------------------------------------------------------------------------------------
// Control choices
// ---------------------------------------------------------------------------------------------------------------

export interface CellInput {
    type: "text" | "date";
    inputMode?: "numeric" | "decimal";
    /** Short unit shown inside the cell, e.g. "%". */
    suffix?: string;
}

/** How a table column's type is entered. Numbers stay `type="text"` so the string is kept exactly as typed. */
export function cellInput(type: TableColumn["type"]): CellInput {
    switch (type) {
        case "date":
            return { type: "date" };
        case "integer":
            return { type: "text", inputMode: "numeric" };
        case "number":
        case "money":
            return { type: "text", inputMode: "decimal" };
        case "percent":
            return { type: "text", inputMode: "decimal", suffix: "%" };
        default:
            return { type: "text" };
    }
}

/**
 * A code whose pattern only admits capital letters (e.g. "[A-Z]{5}[0-9]{4}[A-Z]") is upper-cased as it is typed,
 * so a pasted lower-case PAN is not refused for something the Maker cannot see. Other codes (a pattern with a literal
 * or ranged lower-case letter, or a case-insensitive one) are left as typed.
 */
export function prefersUppercase(field: Pick<FieldDef, "type" | "pattern">): boolean {
    if (field.type !== "code" || !field.pattern) return false;
    const pattern = field.pattern;
    if (/\(\?i/.test(pattern) || !/A-Z/.test(pattern)) return false;
    // Escapes (\d, \w, \.) and group syntax ((?:, (?<name>) contain letters that are not literal text; drop them,
    // then any lower-case letter left is either a literal ("IBUS-" is fine, "ibus-" is not) or a class range (a-z).
    const literal = pattern.replace(/\\./g, "").replace(/\(\?(?:<[A-Za-z_][A-Za-z0-9_]*>|<?[:=!])/g, "");
    return !/[a-z]/.test(literal);
}

/** `options` with the current value added when it is not among them, so a stale value is shown, not silently hidden. */
export function withCurrent(options: readonly string[], current: string | undefined): string[] {
    return current && !options.includes(current) ? [...options, current] : [...options];
}

export const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Same clock the engine uses for "cannot be in the future". */
export const todayIso = () => new Date().toISOString().slice(0, 10);
