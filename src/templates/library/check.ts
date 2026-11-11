// Checking a pasted library. parseLibrary covers the field definitions; this adds the structural checks it does not
// make (null entries, unknown rule kinds, malformed conditions, table column types), without which a saved library
// could make the library screens fail to draw. Pure functions only.
import { parseLibrary } from "../engine";
import type { FieldLibrary } from "../model";

export interface LibraryCheck {
    library?: FieldLibrary;
    errors: string[];
    warnings: string[];
}

const LIST_KEYS = ["families", "documentTypes", "entityMaster", "fields", "rules"] as const;
const COLUMN_TYPES = ["text", "integer", "number", "money", "percent", "date"];
const COMPARE_OPS = ["<", "<=", ">", ">=", "==", "!="];

type Obj = Record<string, unknown>;

const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const isTextList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/** Why a value is not a usable condition, or null when it is one. */
function conditionProblem(c: unknown): string | null {
    if (!isObject(c)) return "is not a condition";
    for (const group of ["all", "any"] as const) {
        if (!(group in c)) continue;
        const parts = c[group];
        if (!Array.isArray(parts) || parts.length === 0) return `"${group}" must be a non-empty list of conditions`;
        for (const part of parts) {
            const problem = conditionProblem(part);
            if (problem) return problem;
        }
        return null;
    }
    if (!isText(c.field)) return 'needs a "field"';
    const equals = c.equals;
    if ("equals" in c && (typeof equals === "string" || typeof equals === "boolean")) return null;
    if ("in" in c && isTextList(c.in) && c.in.length > 0) return null;
    if (c.present === true || c.absent === true) return null;
    return 'needs one of "equals", "in", "present": true or "absent": true';
}

/** Problems that would make a screen fail to draw, or that parseLibrary would stumble over. */
function shapeErrors(raw: Obj): string[] {
    const errors: string[] = [];

    (raw.families as unknown[]).forEach((f, i) => {
        if (!isObject(f) || !isText(f.code) || !isText(f.name)) {
            errors.push(`Family ${i + 1}: must be an object with a "code" and a "name"`);
        }
    });

    (raw.documentTypes as unknown[]).forEach((t, i) => {
        if (!isObject(t) || !isText(t.code) || !isText(t.name)) {
            errors.push(`Document type ${i + 1}: must be an object with a "code" and a "name"`);
            return;
        }
        if (Array.isArray(t.parties) && !t.parties.every((p) => isObject(p) && isText(p.role))) {
            errors.push(`Document type ${t.code}: every party needs a "role"`);
        }
    });

    (raw.entityMaster as unknown[]).forEach((e, i) => {
        if (!isText(e)) errors.push(`Entity ${i + 1}: must be the entity's legal name as text`);
    });

    (raw.fields as unknown[]).forEach((f, i) => {
        if (!isObject(f)) {
            errors.push(`Field ${i + 1}: must be an object`);
            return;
        }
        const where = `Field ${i + 1}${isText(f.key) ? ` (${f.key})` : ""}`;
        for (const k of ["appliesTo", "options", "periods", "currencies", "units"] as const) {
            if (f[k] !== undefined && !isTextList(f[k])) errors.push(`${where}: "${k}" must be a list of text`);
        }
        for (const k of ["requiredWhen", "showWhen"] as const) {
            const problem = f[k] === undefined ? null : conditionProblem(f[k]);
            if (problem) errors.push(`${where}: "${k}" ${problem}`);
        }
        if (f.columns !== undefined) {
            if (!Array.isArray(f.columns)) {
                errors.push(`${where}: "columns" must be a list`);
            } else {
                f.columns.forEach((c, j) => {
                    if (!isObject(c) || !isText(c.key) || !isText(c.label)) {
                        errors.push(`${where}: column ${j + 1} needs a "key" and a "label"`);
                    } else if (typeof c.type !== "string" || !COLUMN_TYPES.includes(c.type)) {
                        errors.push(`${where}: column "${c.key}" type must be one of ${COLUMN_TYPES.join(", ")}`);
                    }
                });
            }
        }
    });

    const ruleIds = new Set<string>();
    (raw.rules as unknown[]).forEach((r, i) => {
        if (!isObject(r)) {
            errors.push(`Rule ${i + 1}: must be an object`);
            return;
        }
        const where = `Rule ${isText(r.id) ? r.id : i + 1}`;
        if (!isText(r.id)) errors.push(`${where}: "id" is required`);
        else if (ruleIds.has(r.id)) errors.push(`${where}: duplicate id`);
        else ruleIds.add(r.id);
        if (!isText(r.message)) errors.push(`${where}: "message" is required`);
        const need = (...keys: string[]) => {
            for (const k of keys) if (!isText(r[k])) errors.push(`${where}: "${r.kind}" rules need "${k}"`);
        };
        switch (r.kind) {
            case "compare":
                need("left", "right");
                if (typeof r.op !== "string" || !COMPARE_OPS.includes(r.op)) {
                    errors.push(`${where}: "op" must be one of ${COMPARE_OPS.join(" ")}`);
                }
                break;
            case "ratio":
                need("field", "of");
                if (typeof r.max !== "number" || !Number.isFinite(r.max))
                    errors.push(`${where}: "max" must be a number`);
                break;
            case "one_sided":
                need("a", "b");
                break;
            case "not_stated":
                need("field");
                break;
            case "when": {
                const problem = conditionProblem(r.when);
                if (problem) errors.push(`${where}: "when" ${problem}`);
                break;
            }
            default:
                errors.push(`${where}: kind must be compare, ratio, one_sided, not_stated or when`);
        }
    });

    return errors;
}

function duplicateEntities(entities: string[]): string[] {
    const seen = new Set<string>();
    const repeated = new Set<string>();
    for (const e of entities) {
        const key = e.trim().replace(/\s+/g, " ").toLowerCase();
        if (seen.has(key)) repeated.add(e);
        seen.add(key);
    }
    return [...repeated].map((e) => `The entity master lists "${e}" more than once`);
}

/**
 * Checks library JSON text. Never throws: anything the engine cannot take is reported as an error. A library is
 * returned only when there are no errors.
 */
export function checkLibraryText(text: string): LibraryCheck {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch (e) {
        return { errors: [`Not valid JSON: ${(e as Error).message}`], warnings: [] };
    }
    if (!isObject(raw)) {
        return {
            errors: ["The library must be a JSON object with families, documentTypes, entityMaster, fields and rules"],
            warnings: [],
        };
    }

    // Lists that are missing are reported by parseLibrary. Entries inside them are only checked when they all exist.
    const errors = LIST_KEYS.every((k) => Array.isArray(raw[k])) ? shapeErrors(raw) : [];

    let parsed: LibraryCheck | null = null;
    try {
        parsed = parseLibrary(text);
    } catch (e) {
        if (errors.length === 0) {
            errors.push(`Could not check the library: ${e instanceof Error ? e.message : "unexpected content"}`);
        }
    }

    const all = [...errors, ...(parsed?.errors ?? []).filter((m) => !errors.includes(m))];
    const warnings = parsed?.warnings ?? [];
    if (all.length === 0 && parsed?.library) {
        return {
            library: parsed.library,
            errors: [],
            warnings: [...warnings, ...duplicateEntities(parsed.library.entityMaster)],
        };
    }
    return { errors: all, warnings };
}
