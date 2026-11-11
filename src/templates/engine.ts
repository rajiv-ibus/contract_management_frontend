// The template engine: composes a document's fields from the project's field library, evaluates conditions,
// validates values into BLOCK / WARN / FLAG issues, fills derived values and formats values for display.
// Nothing here knows about any particular field list; that is all data in a FieldLibrary.
import type {
    AddressValue,
    Condition,
    ContactValue,
    DeriveContext,
    DocumentTypeDef,
    DocumentValues,
    DurationUnit,
    DurationValue,
    FieldDef,
    FieldLibrary,
    FieldType,
    FieldValue,
    Issue,
    MoneyValue,
    NotStated,
    PartyRole,
    PersonValue,
    Rule,
    RuleTier,
} from "./model";

export const NOT_STATED: NotStated = { notStated: true };
export const NOT_STATED_LABEL = "NOT STATED";

export const FIELD_TYPES: FieldType[] = [
    "text",
    "longtext",
    "integer",
    "number",
    "money",
    "percent",
    "date",
    "duration",
    "enum",
    "boolean",
    "code",
    "address",
    "person",
    "person_list",
    "contact_list",
    "table",
    "date_list",
    "formula",
];

export const DEFAULT_UNITS: DurationUnit[] = ["days", "months", "years"];

export function emptyValues(): DocumentValues {
    return { fields: {}, parties: [], custom: [] };
}

// ---------------------------------------------------------------------------------------------------------------
// Value state
// ---------------------------------------------------------------------------------------------------------------

export function isNotStated(v: FieldValue | undefined): v is NotStated {
    return typeof v === "object" && v !== null && !Array.isArray(v) && (v as NotStated).notStated === true;
}

/** Nobody has filled it yet. Not the same as NOT STATED. */
export function isEmpty(v: FieldValue | undefined): boolean {
    if (v === undefined || v === null) return true;
    if (typeof v === "string") return v.trim() === "";
    if (typeof v === "boolean") return false;
    if (Array.isArray(v)) return v.length === 0;
    if (isNotStated(v)) return false;
    if ("amount" in v) return !String(v.amount ?? "").trim();
    if ("unit" in v && "value" in v) return !String(v.value ?? "").trim();
    // Country is left out on purpose: it defaults to India, so it alone is not an answer.
    if ("line1" in v)
        return !v.line1?.trim() && !v.line2?.trim() && !v.city?.trim() && !v.state?.trim() && !v.pin?.trim();
    if ("name" in v && "designation" in v) return !v.name?.trim() && !v.designation?.trim();
    return Object.values(v).every((x) => !String(x ?? "").trim());
}

/** A real answer: not empty and not NOT STATED. */
export const hasValue = (v: FieldValue | undefined) => !isEmpty(v) && !isNotStated(v);

export const allowsNotStated = (f: FieldDef) => f.allowNotStated ?? (f.req === "M" || f.req === "C");

// ---------------------------------------------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------------------------------------------

/** L1 (all) + the family's L2 + the type's L3 + the document's own L4 fields, in library order. */
export function composeFields(library: FieldLibrary, typeCode: string, custom: FieldDef[] = []): FieldDef[] {
    const type = library.documentTypes.find((t) => t.code === typeCode);
    const picked = library.fields.filter((f) => {
        if (f.level === "L1") return true;
        if (f.level === "L2") return !!type && !!f.appliesTo?.includes(type.family);
        if (f.level === "L3") return !!f.appliesTo?.includes(typeCode);
        return false;
    });
    return [...picked, ...custom.map((f) => ({ ...f, level: "L4" as const }))];
}

export const documentFields = (fields: FieldDef[]) => fields.filter((f) => !f.partyScope);

export function partyFields(fields: FieldDef[], role: PartyRole): FieldDef[] {
    return fields.filter(
        (f) =>
            f.partyScope === "all" ||
            (f.partyScope === "internal" && role.internal) ||
            (f.partyScope === "external" && !role.internal),
    );
}

/** Sections in the order they first appear, each with its fields. */
export function groupBySection(fields: FieldDef[]): { section: string; fields: FieldDef[] }[] {
    const groups = new Map<string, FieldDef[]>();
    for (const f of fields) {
        const name = f.section || "Other";
        groups.set(name, [...(groups.get(name) ?? []), f]);
    }
    return [...groups].map(([section, list]) => ({ section, fields: list }));
}

export function levelCounts(fields: FieldDef[]): Record<"L1" | "L2" | "L3" | "L4", number> {
    const counts = { L1: 0, L2: 0, L3: 0, L4: 0 };
    for (const f of fields) counts[f.level] += 1;
    return counts;
}

// ---------------------------------------------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------------------------------------------

function scalar(v: FieldValue | undefined): string | boolean | undefined {
    if (typeof v === "string" || typeof v === "boolean") return v;
    if (isNotStated(v)) return NOT_STATED_LABEL;
    return undefined;
}

export function evalCondition(c: Condition, values: Record<string, FieldValue>): boolean {
    if ("all" in c) return c.all.every((x) => evalCondition(x, values));
    if ("any" in c) return c.any.some((x) => evalCondition(x, values));
    const v = values[c.field];
    if ("present" in c) return hasValue(v);
    if ("absent" in c) return isEmpty(v);
    if ("in" in c) return c.in.includes(String(scalar(v) ?? ""));
    return scalar(v) === c.equals;
}

export const isVisible = (f: FieldDef, values: Record<string, FieldValue>) =>
    !f.showWhen || evalCondition(f.showWhen, values);

export function isRequired(f: FieldDef, values: Record<string, FieldValue>): boolean {
    if (f.req === "M") return true;
    if (f.req === "C") return !!f.requiredWhen && evalCondition(f.requiredWhen, values);
    return false;
}

/** Plain-language description of a condition, for hints like "Mandatory when Stamping instrument is e-Stamp". */
export function describeCondition(c: Condition, labelOf: (key: string) => string): string {
    if ("all" in c) return c.all.map((x) => describeCondition(x, labelOf)).join(" and ");
    if ("any" in c) return c.any.map((x) => describeCondition(x, labelOf)).join(" or ");
    if ("present" in c) return `${labelOf(c.field)} is filled`;
    if ("absent" in c) return `${labelOf(c.field)} is left empty`;
    if ("in" in c) return `${labelOf(c.field)} is ${c.in.join(" or ")}`;
    return `${labelOf(c.field)} is ${c.equals === true ? "Yes" : c.equals === false ? "No" : c.equals}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Validation of one value (BLOCK issues)
// ---------------------------------------------------------------------------------------------------------------

const DECIMAL = /^-?\d+(\.\d+)?$/;
const MONEY = /^\d+(\.\d{1,2})?$/;
const INTEGER = /^-?\d+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^\S+@\S+\.\S+$/;

function isValidDate(s: string) {
    if (!ISO_DATE.test(s)) return false;
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function wholeMatch(pattern: string, s: string) {
    try {
        return new RegExp(`^(?:${pattern})$`).test(s);
    } catch {
        return true; // A broken pattern in the library is reported by parseLibrary, not here.
    }
}

function inRange(f: FieldDef, n: number): string | null {
    if (f.min !== undefined && n < f.min) return `Must be at least ${f.min}`;
    if (f.max !== undefined && n > f.max) return `Must be at most ${f.max}`;
    return null;
}

/** Problems with one value. Every issue here is BLOCK: the document cannot be submitted with it. */
export function validateValue(f: FieldDef, v: FieldValue | undefined, required: boolean): string[] {
    if (f.req === "D") return [];
    if (isEmpty(v)) {
        if (!required) return [];
        return [allowsNotStated(f) ? "Required: enter a value or mark it NOT STATED" : "Required"];
    }
    if (isNotStated(v)) return allowsNotStated(f) ? [] : ["NOT STATED is not allowed for this field"];

    const problems: string[] = [];
    const text = typeof v === "string" ? v.trim() : "";
    switch (f.type) {
        case "text":
        case "longtext":
        case "code":
        case "formula": {
            if (typeof v !== "string") return ["Enter text"];
            if (f.minLength !== undefined && text.length < f.minLength)
                problems.push(`At least ${f.minLength} characters`);
            if (f.maxLength !== undefined && text.length > f.maxLength)
                problems.push(`At most ${f.maxLength} characters`);
            if (f.pattern && !wholeMatch(f.pattern, text))
                problems.push(f.patternHint ? `Format: ${f.patternHint}` : "Wrong format");
            break;
        }
        case "integer": {
            if (!INTEGER.test(text)) return ["Enter a whole number"];
            const r = inRange(f, Number(text));
            if (r) problems.push(r);
            break;
        }
        case "number":
        case "percent": {
            if (!DECIMAL.test(text)) return ["Enter a number"];
            const n = Number(text);
            const r = inRange(
                {
                    ...f,
                    min: f.min ?? (f.type === "percent" ? 0 : undefined),
                    max: f.max ?? (f.type === "percent" ? 100 : undefined),
                },
                n,
            );
            if (r) problems.push(r);
            break;
        }
        case "money": {
            const m = v as MoneyValue;
            if (!MONEY.test(String(m.amount).trim())) return ["Enter an amount, up to 2 decimals"];
            const r = inRange({ ...f, min: f.min ?? 0 }, Number(m.amount));
            if (r) problems.push(r);
            if (f.periods?.length && !m.period) problems.push("Choose the period (for example per month)");
            break;
        }
        case "date": {
            if (!isValidDate(text)) return ["Enter a valid date"];
            if (f.notInFuture && text > new Date().toISOString().slice(0, 10)) problems.push("Cannot be in the future");
            break;
        }
        case "duration": {
            const d = v as DurationValue;
            if (!INTEGER.test(String(d.value).trim()) || Number(d.value) <= 0)
                return ["Enter a whole number greater than 0"];
            if (!d.unit) problems.push("Choose the unit: a bare number is not valid");
            else if (!(f.units ?? DEFAULT_UNITS).includes(d.unit))
                problems.push(`Unit must be ${(f.units ?? DEFAULT_UNITS).join(", ")}`);
            break;
        }
        case "enum": {
            if (typeof v !== "string" || !(f.options ?? []).includes(v))
                problems.push("Choose one of the listed values");
            break;
        }
        case "boolean": {
            if (typeof v !== "boolean") problems.push("Choose Yes or No");
            break;
        }
        case "address": {
            const a = v as AddressValue;
            if (!a.line1?.trim()) problems.push("Address line is required");
            if (!a.city?.trim()) problems.push("City is required");
            if (!a.state?.trim()) problems.push("State is required");
            const india = !a.country || a.country.trim().toLowerCase() === "india";
            if (india && !/^\d{6}$/.test(a.pin?.trim() ?? ""))
                problems.push("Indian addresses need a 6-digit PIN code");
            break;
        }
        case "person": {
            const p = v as PersonValue;
            if (!p.name?.trim()) problems.push("Name is required");
            if (!p.designation?.trim()) problems.push("Designation is required");
            break;
        }
        case "person_list": {
            (v as PersonValue[]).forEach((p, i) => {
                if (!p.name?.trim()) problems.push(`Person ${i + 1}: name is required`);
            });
            break;
        }
        case "contact_list": {
            (v as ContactValue[]).forEach((c, i) => {
                if (!c.name?.trim()) problems.push(`Contact ${i + 1}: name is required`);
                if (c.email?.trim() && !EMAIL.test(c.email.trim()))
                    problems.push(`Contact ${i + 1}: email is not valid`);
            });
            break;
        }
        case "table": {
            const rows = v as Record<string, string>[];
            rows.forEach((row, i) => {
                if (Object.values(row).every((x) => !String(x ?? "").trim())) problems.push(`Row ${i + 1} is empty`);
            });
            break;
        }
        case "date_list": {
            (v as string[]).forEach((d, i) => {
                if (!isValidDate(d)) problems.push(`Date ${i + 1} is not valid`);
            });
            break;
        }
    }
    return problems;
}

// ---------------------------------------------------------------------------------------------------------------
// Cross-field rules (WARN / FLAG, or BLOCK when the library says so)
// ---------------------------------------------------------------------------------------------------------------

// A month is a twelfth of a year, so 12 months and 1 year compare equal.
const UNIT_DAYS: Record<DurationUnit, number> = { days: 1, months: 365 / 12, years: 365 };

/** A value two fields can be compared on: dates as day numbers, durations as days, amounts as numbers. */
function comparable(v: FieldValue | undefined): number | string | null {
    if (!hasValue(v)) return null;
    if (typeof v === "string") {
        if (isValidDate(v)) return Date.parse(`${v}T00:00:00Z`) / 86_400_000;
        if (DECIMAL.test(v.trim())) return Number(v);
        return v.trim().toLowerCase();
    }
    if (typeof v === "object" && !Array.isArray(v)) {
        if ("amount" in v) return Number((v as MoneyValue).amount);
        if ("unit" in v) {
            const d = v as DurationValue;
            // A number typed before its unit is chosen cannot be compared yet.
            if (!d.unit || !Number.isFinite(Number(d.value))) return null;
            return Number(d.value) * UNIT_DAYS[d.unit];
        }
        if ("city" in v) return (v as AddressValue).city.trim().toLowerCase();
    }
    return null;
}

function holds(op: string, a: number | string, b: number | string) {
    switch (op) {
        case "<":
            return a < b;
        case "<=":
            return a <= b;
        case ">":
            return a > b;
        case ">=":
            return a >= b;
        case "==":
            return a === b;
        default:
            return a !== b;
    }
}

/** The field keys a rule reads. */
export function ruleFieldKeys(rule: Rule): string[] {
    switch (rule.kind) {
        case "compare":
            return [rule.left, rule.right];
        case "ratio":
            return [rule.field, rule.of];
        case "one_sided":
            return [rule.a, rule.b];
        case "not_stated":
            return [rule.field];
        default:
            return conditionFields(rule.when);
    }
}

/**
 * A compare or ratio rule states what must hold; an issue is raised when it does not.
 * one_sided raises when exactly one of the two fields is NOT STATED; when and not_stated raise when they match.
 * `applicable` limits the rules to the fields this document actually has: a rule that reads a field the document
 * type does not carry (or one hidden by showWhen) is skipped, so "field X left empty" cannot fire on a type without X.
 */
export function runRules(rules: Rule[], values: Record<string, FieldValue>, applicable?: ReadonlySet<string>): Issue[] {
    const issues: Issue[] = [];
    for (const rule of rules) {
        if (applicable && !ruleFieldKeys(rule).every((key) => applicable.has(key))) continue;
        let fires = false;
        let fieldKey: string | undefined;
        if (rule.kind === "compare") {
            const a = comparable(values[rule.left]);
            const b = comparable(values[rule.right]);
            fires = a !== null && b !== null && typeof a === typeof b && !holds(rule.op, a, b);
            fieldKey = rule.left;
        } else if (rule.kind === "ratio") {
            const a = comparable(values[rule.field]);
            const b = comparable(values[rule.of]);
            fires = typeof a === "number" && typeof b === "number" && b > 0 && a > rule.max * b;
            fieldKey = rule.field;
        } else if (rule.kind === "one_sided") {
            const a = values[rule.a];
            const b = values[rule.b];
            fires = (isNotStated(a) && hasValue(b)) || (isNotStated(b) && hasValue(a));
            fieldKey = rule.a;
        } else if (rule.kind === "when") {
            fires = evalCondition(rule.when, values);
        } else if (rule.kind === "not_stated") {
            fires = isNotStated(values[rule.field]);
            fieldKey = rule.field;
        }
        if (fires) issues.push({ tier: rule.tier, message: rule.message, fieldKey, ruleId: rule.id });
    }
    return issues;
}

// ---------------------------------------------------------------------------------------------------------------
// Whole-document validation
// ---------------------------------------------------------------------------------------------------------------

/** A field belongs to the Maker's submission unless the library says it is collected at approval. */
const inPhase = (f: FieldDef, phase: "submit" | "approve") => (f.phase ?? "submit") === phase;

/**
 * Validates one document. `phase` picks whose answers are being checked: "submit" (the Maker's form, the default)
 * ignores fields the Checker answers at approval; "approve" checks only those.
 */
export function validateDocument(
    library: FieldLibrary,
    fields: FieldDef[],
    type: DocumentTypeDef | undefined,
    values: DocumentValues,
    phase: "submit" | "approve" = "submit",
): Issue[] {
    const issues: Issue[] = [];

    for (const f of documentFields(fields)) {
        if (!inPhase(f, phase) || !isVisible(f, values.fields)) continue;
        for (const message of validateValue(f, values.fields[f.key], isRequired(f, values.fields))) {
            issues.push({ tier: "BLOCK", message, fieldKey: f.key });
        }
    }

    for (const role of type?.parties ?? []) {
        if (!values.parties.some((p) => p.role === role.role)) {
            issues.push({ tier: "BLOCK", message: `Add the ${role.role} party` });
        }
    }

    for (const party of values.parties) {
        const role = type?.parties.find((r) => r.role === party.role);
        if (!role) continue;
        for (const f of partyFields(fields, role)) {
            if (!inPhase(f, phase) || !isVisible(f, party.values)) continue;
            const v = party.values[f.key];
            for (const message of validateValue(f, v, isRequired(f, party.values))) {
                issues.push({ tier: "BLOCK", message, fieldKey: f.key, partyId: party.id });
            }
            const entityField = role.internal && f.options === undefined && /entity/.test(f.key);
            if (entityField && typeof v === "string" && v.trim() && !library.entityMaster.includes(v)) {
                issues.push({
                    tier: "BLOCK",
                    message: "Must be an entity from the entity master",
                    fieldKey: f.key,
                    partyId: party.id,
                });
            }
        }
    }

    // Rules only apply to fields this document has and shows.
    const applicable = new Set(
        documentFields(fields)
            .filter((f) => isVisible(f, values.fields))
            .map((f) => f.key),
    );
    issues.push(...runRules(library.rules, values.fields, applicable));
    return issues;
}

export const issuesFor = (issues: Issue[], fieldKey: string, partyId?: string) =>
    issues.filter((i) => i.fieldKey === fieldKey && i.partyId === partyId);

export function countByTier(issues: Issue[]): Record<RuleTier, number> {
    const counts = { BLOCK: 0, WARN: 0, FLAG: 0 };
    for (const i of issues) counts[i.tier] += 1;
    return counts;
}

/** Fraction of visible mandatory fields answered (a value or NOT STATED), for progress indicators. */
export function completion(
    fields: FieldDef[],
    values: Record<string, FieldValue>,
    phase: "submit" | "approve" = "submit",
): { done: number; total: number } {
    const mandatory = documentFields(fields).filter(
        (f) => f.req !== "D" && inPhase(f, phase) && isVisible(f, values) && isRequired(f, values),
    );
    return { done: mandatory.filter((f) => !isEmpty(values[f.key])).length, total: mandatory.length };
}

// ---------------------------------------------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------------------------------------------

function addDuration(isoDate: string, d: DurationValue): string {
    const date = new Date(`${isoDate}T00:00:00Z`);
    const n = Number(d.value);
    if (d.unit === "days") date.setUTCDate(date.getUTCDate() + n);
    if (d.unit === "months") date.setUTCMonth(date.getUTCMonth() + n);
    if (d.unit === "years") date.setUTCFullYear(date.getUTCFullYear() + n);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
}

function expiryFrom(values: Record<string, FieldValue>, durationKey: string): string {
    const start = values.effective_date;
    const term = values[durationKey];
    if (isNotStated(start) || isNotStated(term)) return "Blocked: an input is NOT STATED";
    if (typeof start !== "string" || !isValidDate(start) || !hasValue(term)) return "";
    const duration = term as DurationValue;
    // A number typed before its unit is chosen gives no date yet (validation asks for the unit).
    if (!duration.unit || !Number.isFinite(Number(duration.value))) return "";
    return addDuration(start, duration);
}

/** The system's value for a D field. Empty string when it cannot be worked out yet. */
export function deriveValue(f: FieldDef, ctx: DeriveContext, values: Record<string, FieldValue>): string {
    switch (f.derive) {
        case "instance_id":
            return ctx.instanceId ?? "Assigned on first submission";
        case "document_type_id":
            return ctx.documentTypeCode ?? "";
        case "term_expiry_date":
            return expiryFrom(values, "term_duration");
        case "lockin_expiry_date":
            return expiryFrom(values, "lockin_duration");
        case "prepared_by":
            return ctx.preparedBy ?? "";
        case "verified_by":
            return ctx.verifiedBy ?? "Filled on approval";
        case "sheet_status":
            return ctx.status ?? "";
        case "scanned_pdf_ref":
            return ctx.fileRef ?? "Filled when the PDF is stored";
        case "execution_completeness":
            return values.execution_mode === "Accepted by conduct"
                ? "Not executed"
                : "Worked out from the signature, date and witness fields";
        default:
            return "";
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(iso: string): string {
    if (!isValidDate(iso)) return iso;
    const [y, m, d] = iso.split("-");
    return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

export function formatMoney(m: MoneyValue): string {
    const n = Number(m.amount);
    const amount = Number.isFinite(n)
        ? n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : m.amount;
    const symbol = m.currency === "INR" || !m.currency ? "₹" : `${m.currency} `;
    return `${symbol}${symbol === "₹" ? " " : ""}${amount}${m.period ? ` ${m.period}` : ""}`;
}

const formatDuration = (d: DurationValue) => {
    const n = Number(d.value);
    const unit = d.unit ? (n === 1 ? d.unit.replace(/s$/, "") : d.unit) : "(no unit)";
    return `${d.value} ${unit}`;
};

const formatAddress = (a: AddressValue) =>
    [
        a.line1,
        a.line2,
        a.city,
        a.state && a.pin ? `${a.state} ${a.pin}` : a.state || a.pin,
        a.country && a.country !== "India" ? a.country : "",
    ]
        .filter((x) => x && String(x).trim())
        .join(", ");

/** One-line text for any value, as printed on the summary sheet. Empty string when nothing was entered. */
export function formatValue(f: FieldDef, v: FieldValue | undefined): string {
    if (isNotStated(v)) return NOT_STATED_LABEL;
    if (isEmpty(v)) return "";
    switch (f.type) {
        case "date":
            return formatDate(v as string);
        case "money":
            return formatMoney(v as MoneyValue);
        case "percent":
            return `${v as string} %`;
        case "duration":
            return formatDuration(v as DurationValue);
        case "boolean":
            return v === true ? "Yes" : "No";
        case "address":
            return formatAddress(v as AddressValue);
        case "person": {
            const p = v as PersonValue;
            return [p.name, p.designation].filter(Boolean).join(", ");
        }
        case "person_list":
            return (v as PersonValue[]).map((p) => [p.name, p.designation].filter(Boolean).join(", ")).join("; ");
        case "contact_list":
            return (v as ContactValue[])
                .map((c) => [c.name, c.role, c.email, c.phone].filter(Boolean).join(", "))
                .join("; ");
        case "table": {
            const rows = v as Record<string, string>[];
            return `${rows.length} row${rows.length === 1 ? "" : "s"}`;
        }
        case "date_list":
            return (v as string[]).map(formatDate).join(", ");
        default:
            return String(v);
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Checking a pasted library
// ---------------------------------------------------------------------------------------------------------------

const KEY = /^[a-z][a-z0-9_]*$/;

function conditionFields(c: Condition | undefined): string[] {
    if (!c) return [];
    if ("all" in c) return c.all.flatMap(conditionFields);
    if ("any" in c) return c.any.flatMap(conditionFields);
    return [c.field];
}

/** Structural check of a library JSON before it is saved as a new version. */
export function parseLibrary(json: string): { library?: FieldLibrary; errors: string[]; warnings: string[] } {
    let raw: unknown;
    try {
        raw = JSON.parse(json);
    } catch (e) {
        return { errors: [`Not valid JSON: ${(e as Error).message}`], warnings: [] };
    }
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        return {
            errors: ["The library must be a JSON object with families, documentTypes, entityMaster, fields and rules"],
            warnings: [],
        };
    }
    try {
        return checkLibraryShape(raw as Partial<FieldLibrary>);
    } catch (e) {
        // A malformed entry (null, wrong type) must produce a message, never a crash.
        return { errors: [`The library structure is not valid: ${(e as Error).message}`], warnings: [] };
    }
}

function checkLibraryShape(lib: Partial<FieldLibrary>): {
    library?: FieldLibrary;
    errors: string[];
    warnings: string[];
} {
    const errors: string[] = [];
    const warnings: string[] = [];
    for (const k of ["families", "documentTypes", "entityMaster", "fields", "rules"] as const) {
        if (!Array.isArray(lib[k])) errors.push(`"${k}" must be a list`);
    }
    if (errors.length) return { errors, warnings };

    const families = new Set(lib.families!.map((f) => f.code));
    const types = new Set(lib.documentTypes!.map((t) => t.code));
    for (const t of lib.documentTypes!) {
        if (!families.has(t.family)) errors.push(`Document type ${t.code}: unknown family "${t.family}"`);
        if (!Array.isArray(t.parties) || t.parties.length === 0)
            errors.push(`Document type ${t.code}: needs at least one party role`);
    }

    const keys = new Set<string>();
    for (const [i, f] of lib.fields!.entries()) {
        const where = `Field ${i + 1}${f?.key ? ` (${f.key})` : ""}`;
        if (!f.key || !KEY.test(f.key)) errors.push(`${where}: key must be lower_snake_case`);
        if (keys.has(f.key)) errors.push(`${where}: duplicate key`);
        keys.add(f.key);
        if (!f.label) errors.push(`${where}: label is required`);
        if (!FIELD_TYPES.includes(f.type)) errors.push(`${where}: unknown type "${f.type}"`);
        if (!["L1", "L2", "L3"].includes(f.level))
            errors.push(`${where}: level must be L1, L2 or L3 (L4 is added on a document)`);
        if (!["M", "O", "D", "C"].includes(f.req)) errors.push(`${where}: req must be M, O, D or C`);
        if (f.type === "enum" && !f.options?.length) errors.push(`${where}: enum fields need "options"`);
        if (f.type === "table" && !f.columns?.length) errors.push(`${where}: table fields need "columns"`);
        if (f.req === "C" && !f.requiredWhen) errors.push(`${where}: C fields need "requiredWhen"`);
        if (f.req === "D" && !f.derive) errors.push(`${where}: D fields need "derive"`);
        if (f.level === "L2" && !f.appliesTo?.every((c) => families.has(c)))
            errors.push(`${where}: L2 "appliesTo" must list family codes`);
        if (f.level === "L3" && !f.appliesTo?.every((c) => types.has(c)))
            errors.push(`${where}: L3 "appliesTo" must list document type codes`);
        if ((f.level === "L2" || f.level === "L3") && !f.appliesTo?.length)
            errors.push(`${where}: "appliesTo" is required for ${f.level}`);
        if (f.pattern) {
            try {
                new RegExp(f.pattern);
            } catch {
                errors.push(`${where}: pattern is not a valid regular expression`);
            }
        }
        if (!f.section) warnings.push(`${where}: no section, it will be shown under "Other"`);
    }
    for (const f of lib.fields!) {
        for (const key of [...conditionFields(f.requiredWhen), ...conditionFields(f.showWhen)]) {
            if (!keys.has(key)) errors.push(`Field ${f.key}: condition refers to unknown field "${key}"`);
        }
    }
    for (const r of lib.rules!) {
        const refs =
            r.kind === "compare"
                ? [r.left, r.right]
                : r.kind === "ratio"
                  ? [r.field, r.of]
                  : r.kind === "one_sided"
                    ? [r.a, r.b]
                    : r.kind === "not_stated"
                      ? [r.field]
                      : conditionFields(r.when);
        for (const key of refs) if (!keys.has(key)) errors.push(`Rule ${r.id}: unknown field "${key}"`);
        if (!["BLOCK", "WARN", "FLAG"].includes(r.tier)) errors.push(`Rule ${r.id}: tier must be BLOCK, WARN or FLAG`);
    }
    if (!lib.entityMaster!.length)
        warnings.push("The entity master is empty: internal parties will have nothing to choose from");

    return errors.length
        ? { errors, warnings }
        : { library: { ...(lib as FieldLibrary), version: lib.version ?? 1 }, errors, warnings };
}
