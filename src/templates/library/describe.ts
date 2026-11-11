// Plain-language descriptions of library definitions, and the lookups the library manager screens share.
// Pure functions only: nothing here renders.
import { DEFAULT_UNITS, allowsNotStated, describeCondition } from "../engine";
import type {
    Condition,
    DeriveRule,
    FieldDef,
    FieldLevel,
    FieldLibrary,
    FieldType,
    Requirement,
    Rule,
    RuleTier,
} from "../model";

export const TYPE_LABEL: Record<FieldType, string> = {
    text: "Short text",
    longtext: "Long text",
    integer: "Whole number",
    number: "Number",
    money: "Amount of money",
    percent: "Percentage",
    date: "Date",
    duration: "Duration",
    enum: "Choice",
    boolean: "Yes / No",
    code: "Code",
    address: "Address",
    person: "Person",
    person_list: "List of people",
    contact_list: "List of contacts",
    table: "Table",
    date_list: "List of dates",
    formula: "Formula",
};

export const REQ_META: Record<Requirement, { label: string; title: string }> = {
    M: { label: "Mandatory", title: "Mandatory: a value or NOT STATED is required" },
    O: { label: "Optional", title: "Optional: may be left empty" },
    D: { label: "Derived", title: "Derived: filled in by the system, never typed" },
    C: { label: "Conditional", title: "Conditional: mandatory only when its condition holds" },
};

export const LEVEL_META: Record<FieldLevel, { name: string; title: string }> = {
    L1: { name: "Org", title: "L1 Org: on every document type" },
    L2: { name: "Family", title: "L2 Family: on the document types of one family" },
    L3: { name: "Type", title: "L3 Type: on one document type" },
    L4: { name: "Document", title: "L4 Document: a one-off field on a single document" },
};

export const TIER_META: Record<RuleTier, { label: string; effect: string }> = {
    BLOCK: { label: "Block", effect: "Refuses submission until fixed." },
    WARN: { label: "Warn", effect: "Lets the document through and shows the Checker." },
    FLAG: { label: "Flag", effect: "Printed on the summary sheet for the signer." },
};

export const DERIVE_TEXT: Record<DeriveRule, string> = {
    instance_id: "The document's instance ID, assigned on first submission",
    document_type_id: "The document type's register ID",
    term_expiry_date: "Effective date plus the term duration",
    lockin_expiry_date: "Effective date plus the lock-in duration",
    prepared_by: "The Maker who prepared the document",
    verified_by: "The Checker who approved the document",
    sheet_status: "The workflow status of the summary sheet",
    scanned_pdf_ref: "Reference of the stored scanned PDF",
    execution_completeness: "Worked out from the signature, date and witness fields",
};

// ---------------------------------------------------------------------------------------------------------------
// Conditions and rules
// ---------------------------------------------------------------------------------------------------------------

export function conditionKeys(c: Condition | undefined): string[] {
    if (!c || typeof c !== "object") return [];
    if ("all" in c) return Array.isArray(c.all) ? c.all.flatMap(conditionKeys) : [];
    if ("any" in c) return Array.isArray(c.any) ? c.any.flatMap(conditionKeys) : [];
    return typeof c.field === "string" ? [c.field] : [];
}

const unique = (keys: string[]) => [...new Set(keys)];

/** Field keys a rule reads. A rule of an unknown kind reads none. */
export function ruleFieldKeys(rule: Rule): string[] {
    switch (rule.kind) {
        case "compare":
            return unique([rule.left, rule.right]);
        case "ratio":
            return unique([rule.field, rule.of]);
        case "one_sided":
            return unique([rule.a, rule.b]);
        case "not_stated":
            return [rule.field];
        case "when":
            return unique(conditionKeys(rule.when));
        default:
            return [];
    }
}

const OP_TEXT: Record<string, string> = {
    "<": "less than",
    "<=": "at most",
    ">": "greater than",
    ">=": "at least",
    "==": "equal to",
    "!=": "different from",
};

/** What the rule checks, in a sentence. Tolerates a rule the engine does not know, so a screen never fails on it. */
export function describeRule(rule: Rule, labelOf: (key: string) => string): string {
    switch (rule.kind) {
        case "compare":
            return `${labelOf(rule.left)} must be ${OP_TEXT[rule.op] ?? rule.op} ${labelOf(rule.right)}.`;
        case "ratio":
            return `${labelOf(rule.field)} must not be more than ${formatNumber(rule.max * 100)}% of ${labelOf(rule.of)}.`;
        case "one_sided":
            return `Raised when one of ${labelOf(rule.a)} and ${labelOf(rule.b)} is NOT STATED while the other has a value.`;
        case "not_stated":
            return `Raised when ${labelOf(rule.field)} is NOT STATED.`;
        case "when":
            return rule.when
                ? `Raised when ${describeCondition(rule.when, labelOf)}.`
                : "Raised when its condition holds.";
        default:
            return "A rule of a kind this version does not recognise.";
    }
}

function formatNumber(n: number): string {
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

// ---------------------------------------------------------------------------------------------------------------
// Where a field applies
// ---------------------------------------------------------------------------------------------------------------

/** Whether a field is part of at least one document of this family. */
export function appliesToFamily(library: FieldLibrary, f: FieldDef, familyCode: string): boolean {
    if (f.level === "L1") return true;
    if (f.level === "L2") return !!f.appliesTo?.includes(familyCode);
    if (f.level === "L3") {
        return library.documentTypes.some((t) => t.family === familyCode && !!f.appliesTo?.includes(t.code));
    }
    return false;
}

/** Whether a field is part of documents of this type (the same test composeFields applies). */
export function appliesToType(library: FieldLibrary, f: FieldDef, typeCode: string): boolean {
    if (f.level === "L1") return true;
    if (f.level === "L2") {
        const type = library.documentTypes.find((t) => t.code === typeCode);
        return !!type && !!f.appliesTo?.includes(type.family);
    }
    if (f.level === "L3") return !!f.appliesTo?.includes(typeCode);
    return false;
}

/** "All document types", family names for L2, document type codes for L3. */
export function appliesToList(library: FieldLibrary, f: FieldDef): string[] {
    if (f.level === "L1") return ["All document types"];
    if (f.level === "L2") {
        return (f.appliesTo ?? []).map((code) => library.families.find((fam) => fam.code === code)?.name ?? code);
    }
    if (f.level === "L3") return f.appliesTo ?? [];
    return ["One document only"];
}

// ---------------------------------------------------------------------------------------------------------------
// What a field accepts
// ---------------------------------------------------------------------------------------------------------------

export interface Constraint {
    label: string;
    text: string;
    /** Shown in monospace after the text, e.g. the raw pattern. */
    code?: string;
    /** Shown as a list of chips, e.g. the allowed options. */
    items?: string[];
}

function range(min: number | undefined, max: number | undefined, unit = ""): string | null {
    const u = unit ? ` ${unit}` : "";
    if (min !== undefined && max !== undefined) return `from ${min} to ${max}${u}`;
    if (min !== undefined) return `at least ${min}${u}`;
    if (max !== undefined) return `at most ${max}${u}`;
    return null;
}

/** The checks a value must pass, in plain language. */
export function describeConstraints(f: FieldDef): Constraint[] {
    const out: Constraint[] = [];
    const push = (label: string, text: string, extra: Partial<Constraint> = {}) => out.push({ label, text, ...extra });

    if (f.req === "D") {
        push("Value", "Filled in by the system. Nobody types it.");
        return out;
    }

    switch (f.type) {
        case "text":
        case "longtext":
        case "code":
        case "formula": {
            const length = range(f.minLength, f.maxLength, "characters");
            if (length) push("Length", length);
            if (f.pattern) {
                push("Format", f.patternHint ?? "Must match a fixed pattern", { code: f.pattern });
            } else if (f.patternHint) {
                push("Format", f.patternHint);
            }
            break;
        }
        case "integer": {
            push("Value", "A whole number");
            const r = range(f.min, f.max);
            if (r) push("Range", r);
            break;
        }
        case "number": {
            push("Value", "A number");
            const r = range(f.min, f.max);
            if (r) push("Range", r);
            break;
        }
        case "percent": {
            push("Value", "A percentage");
            push("Range", range(f.min ?? 0, f.max ?? 100) ?? "from 0 to 100");
            break;
        }
        case "money": {
            push("Value", "An amount with up to 2 decimals");
            push("Range", range(f.min ?? 0, f.max) ?? "at least 0");
            push("Currencies", (f.currencies?.length ? f.currencies : ["INR"]).join(", "));
            if (f.periods?.length) push("Period", "A period must be chosen", { items: f.periods });
            break;
        }
        case "date": {
            push("Value", "A calendar date");
            if (f.notInFuture) push("Restriction", "Cannot be in the future");
            break;
        }
        case "duration": {
            push("Value", "A whole number greater than 0, with a unit");
            push("Units", (f.units?.length ? f.units : DEFAULT_UNITS).join(", "));
            break;
        }
        case "enum": {
            push("Allowed values", "One of the listed values", { items: f.options ?? [] });
            break;
        }
        case "boolean": {
            push("Value", "Yes or No");
            break;
        }
        case "address": {
            push("Value", "Address line, city, state and country; Indian addresses need a 6-digit PIN code");
            break;
        }
        case "person": {
            push("Value", "Name and designation");
            break;
        }
        case "person_list": {
            push("Value", "A list of people, each with a name and designation");
            break;
        }
        case "contact_list": {
            push("Value", "A list of contacts: name, role, email and phone");
            break;
        }
        case "date_list": {
            push("Value", "A list of calendar dates");
            break;
        }
        case "table": {
            push("Columns", "A table with these columns", {
                items: (f.columns ?? []).map(
                    (c) => `${c.label} (${(TYPE_LABEL[c.type] ?? String(c.type)).toLowerCase()})`,
                ),
            });
            break;
        }
    }

    push(
        "NOT STATED",
        allowsNotStated(f)
            ? "Accepted. The summary sheet prints it in bold so the signer sees it."
            : "Not accepted. Either a real value is entered or the field stays empty.",
    );
    return out;
}

/** Whether two lists hold the same entries in the same order. */
export function sameList(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** Stable JSON text: object keys sorted, so two libraries with the same content compare equal. */
export function stableStringify(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    if (value && typeof value === "object") {
        const entries = Object.entries(value as Record<string, unknown>)
            .filter(([, v]) => v !== undefined)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
        return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
    }
    return JSON.stringify(value);
}

/** Whether two libraries hold the same content, ignoring the version number and key order. */
export function sameLibraryContent(a: FieldLibrary, b: FieldLibrary): boolean {
    return stableStringify({ ...a, version: 0 }) === stableStringify({ ...b, version: 0 });
}
