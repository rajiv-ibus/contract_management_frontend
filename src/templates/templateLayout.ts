// Pure layout helpers shared by the form, the read view and the summary sheet. No business rules live here: every
// rule (required, visible, derived, valid) comes from the engine.
import { documentFields, groupBySection, isEmpty, isVisible, partyFields } from "./engine";
import type { FieldDef, FieldLevel, FieldType, FieldValue, PartyRole, PartyValues } from "./model";

/** Types whose control (or printed value) needs the full width. */
const LONG_TYPES: ReadonlySet<FieldType> = new Set<FieldType>([
    "longtext",
    "address",
    "table",
    "person_list",
    "contact_list",
    "date_list",
    "formula",
]);

export const isLongType = (type: FieldType) => LONG_TYPES.has(type);

export const LEVEL_INFO: Record<FieldLevel, { name: string; hint: string }> = {
    L1: { name: "Organisation", hint: "On every document type" },
    L2: { name: "Family", hint: "On a family of document types" },
    L3: { name: "Document type", hint: "On this document type only" },
    L4: { name: "This document", hint: "Added to this document only" },
};

/** The internal party's entity field is a closed list taken from the entity master. */
export const isEntityField = (f: FieldDef, role: PartyRole) =>
    role.internal && f.options === undefined && /entity/.test(f.key);

export interface Section {
    section: string;
    fields: FieldDef[];
}

/** Document-level sections holding at least one field that is visible for these values. Hidden values are kept. */
export function documentSections(composed: FieldDef[], values: Record<string, FieldValue>): Section[] {
    return groupBySection(documentFields(composed))
        .map((g) => ({ section: g.section, fields: g.fields.filter((f) => isVisible(f, values)) }))
        .filter((g) => g.fields.length > 0);
}

/** Sections of one party's fields, visible for that party's own values. */
export function partySections(composed: FieldDef[], role: PartyRole, values: Record<string, FieldValue>): Section[] {
    return groupBySection(partyFields(composed, role))
        .map((g) => ({ section: g.section, fields: g.fields.filter((f) => isVisible(f, values)) }))
        .filter((g) => g.fields.length > 0);
}

export const partiesOfRole = (parties: PartyValues[], role: string) => parties.filter((p) => p.role === role);

/** "Supplier" when the role has one party, "Supplier 2" when it has several. */
export function partyName(parties: PartyValues[], party: PartyValues): string {
    const same = partiesOfRole(parties, party.role);
    return same.length > 1 ? `${party.role} ${same.findIndex((p) => p.id === party.id) + 1}` : party.role;
}

export function newId(prefix: string): string {
    const random =
        typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID().slice(0, 8)
            : Math.random().toString(36).slice(2, 10);
    return `${prefix}-${random}`;
}

const blank = (x: unknown) => x === undefined || x === null || x === "";

/** Deep JSON-style comparison where a missing property and an empty string are the same thing. */
export function deepEqual(a: unknown, b: unknown): boolean {
    if (blank(a) && blank(b)) return true;
    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
        return a.every((x, i) => deepEqual(x, b[i]));
    }
    if (typeof a === "object" && typeof b === "object" && a !== null && b !== null) {
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        return [...keys].every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
    }
    return a === b;
}

/** Same answer? Two unanswered fields are equal; otherwise compare deeply. */
export function sameValue(a: FieldValue | undefined, b: FieldValue | undefined): boolean {
    if (isEmpty(a) && isEmpty(b)) return true;
    return deepEqual(a, b);
}

/** lower_snake_case key from a label, unique against `taken` (suffix _2, _3 ...). */
export function uniqueKey(label: string, taken: Iterable<string>): string {
    const used = new Set(taken);
    let base = label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    if (!base) base = "field";
    if (!/^[a-z]/.test(base)) base = `f_${base}`;
    if (!used.has(base)) return base;
    let n = 2;
    while (used.has(`${base}_${n}`)) n += 1;
    return `${base}_${n}`;
}
