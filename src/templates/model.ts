// Field templates are configuration data, not code. A project's field library (fields, rules, families and
// document types) is JSON that a project Admin pastes or uploads; the app only knows how to compose,
// render and validate it. These types are that JSON's contract.

/** Kinds of input a field can have. Each one has its own input control and checks. */
export type FieldType =
    | "text"
    | "longtext"
    | "integer"
    | "number"
    | "money"
    | "percent"
    | "date"
    | "duration"
    | "enum"
    | "boolean"
    | "code"
    | "address"
    | "person"
    | "person_list"
    | "contact_list"
    | "table"
    | "date_list"
    | "formula";

/**
 * L1 Org: on every document type. L2 Family: on the types of one family. L3 Type: on one document type.
 * L4 Document: a one-off field a Maker adds to a single document.
 */
export type FieldLevel = "L1" | "L2" | "L3" | "L4";

/** M mandatory, O optional, D derived by the system (never typed), C mandatory when `requiredWhen` holds. */
export type Requirement = "M" | "O" | "D" | "C";

/** BLOCK refuses submission. WARN lets it through and shows the Checker. FLAG is printed on the summary sheet. */
export type RuleTier = "BLOCK" | "WARN" | "FLAG";

/** A condition over other field values (non-party fields only). */
export type Condition =
    | { field: string; equals: string | boolean }
    | { field: string; in: string[] }
    | { field: string; present: true }
    /** True when the field has no answer at all: empty, not NOT STATED. */
    | { field: string; absent: true }
    | { all: Condition[] }
    | { any: Condition[] };

export type DurationUnit = "days" | "months" | "years";

export interface TableColumn {
    key: string;
    label: string;
    type: "text" | "integer" | "number" | "money" | "percent" | "date";
}

/** Values the system fills in for D fields. */
export type DeriveRule =
    | "instance_id"
    | "document_type_id"
    | "term_expiry_date"
    | "lockin_expiry_date"
    | "prepared_by"
    | "verified_by"
    | "sheet_status"
    | "scanned_pdf_ref"
    | "execution_completeness";

/** Which parties a party-scoped field appears on. */
export type PartyScope = "all" | "internal" | "external";

export interface FieldDef {
    /** Stable machine key. Never changes once issued. */
    key: string;
    label: string;
    type: FieldType;
    level: FieldLevel;
    req: Requirement;
    /** Section theme the field is grouped under on the form and the summary sheet. */
    section: string;
    description?: string;
    /** L2: family codes the field applies to. L3: document type codes. Ignored for L1 and L4. */
    appliesTo?: string[];
    /** Repeated once per party on the document instead of once per document. */
    partyScope?: PartyScope;
    /** enum: allowed values. */
    options?: string[];
    /** Whether "NOT STATED" is an accepted answer. Defaults to true for M and C fields, false otherwise. */
    allowNotStated?: boolean;
    /** code / text: regular expression the whole value must match. */
    pattern?: string;
    /** Human hint shown with the pattern, e.g. "10 characters: ABCDE1234F". */
    patternHint?: string;
    minLength?: number;
    maxLength?: number;
    /** integer / number / money / percent: inclusive bounds. */
    min?: number;
    max?: number;
    /** duration: allowed units. Defaults to days, months, years. */
    units?: DurationUnit[];
    /** money: allowed periods ("one-time", "per month", ...). When set, a period must be chosen. */
    periods?: string[];
    /** money: allowed currencies. Defaults to INR. */
    currencies?: string[];
    /** date: refuse dates after today. */
    notInFuture?: boolean;
    /** table: column definitions. */
    columns?: TableColumn[];
    /** C fields: becomes mandatory when this holds. */
    requiredWhen?: Condition;
    /** Shown only when this holds. Hidden fields are never validated. */
    showWhen?: Condition;
    /** D fields: how the system fills the value. */
    derive?: DeriveRule;
    /**
     * When the answer is collected. "submit" (default): the Maker, in the document form. "approve": the Checker,
     * on the approval screen (for example the attestation that every value reflects the document).
     */
    phase?: "submit" | "approve";
}

/** Cross-field rules. Field keys refer to non-party fields. A rule is skipped when an input is empty or NOT STATED. */
export type Rule = { id: string; tier: RuleTier; message: string } & (
    | { kind: "compare"; left: string; op: "<" | "<=" | ">" | ">=" | "==" | "!="; right: string }
    | { kind: "ratio"; field: string; of: string; max: number }
    | { kind: "one_sided"; a: string; b: string }
    | { kind: "when"; when: Condition }
    | { kind: "not_stated"; field: string }
);

export interface Family {
    code: string;
    name: string;
}

export interface PartyRole {
    role: string;
    /** The iBUS side of the agreement. Internal parties pick their entity from the entity master. */
    internal: boolean;
}

export interface DocumentTypeDef {
    /** Register ID, e.g. IBUS-PRC-WH-IN. */
    code: string;
    name: string;
    family: string;
    parties: PartyRole[];
}

/** One project's field library. Saved versions are frozen; a change creates a new version. */
export interface FieldLibrary {
    version: number;
    families: Family[];
    documentTypes: DocumentTypeDef[];
    /** Ratified iBUS legal entities. Internal parties must pick one of these. */
    entityMaster: string[];
    fields: FieldDef[];
    rules: Rule[];
}

// ---------------------------------------------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------------------------------------------

/** "The agreement is silent on this." A finding, not a blank. */
export interface NotStated {
    notStated: true;
}

export interface MoneyValue {
    /** Decimal string, e.g. "185000.00", so no precision is lost. */
    amount: string;
    currency: string;
    period?: string;
}

export interface DurationValue {
    value: string;
    unit: DurationUnit;
}

export interface AddressValue {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pin: string;
    country: string;
}

export interface PersonValue {
    name: string;
    designation: string;
}

export interface ContactValue {
    name: string;
    role: string;
    email: string;
    phone: string;
}

/** Numbers are kept as strings, exactly as typed. Booleans are true or false; "unknown" is NotStated. */
export type FieldValue =
    | string
    | boolean
    | string[]
    | NotStated
    | MoneyValue
    | DurationValue
    | AddressValue
    | PersonValue
    | PersonValue[]
    | ContactValue[]
    | Record<string, string>[];

export interface PartyValues {
    id: string;
    role: string;
    values: Record<string, FieldValue>;
}

/** Everything a Maker enters for one document (and what a version freezes). */
export interface DocumentValues {
    fields: Record<string, FieldValue>;
    parties: PartyValues[];
    /** L4 fields the Maker added to this document only. */
    custom: FieldDef[];
}

/** A problem found by validation. `partyId` is set for party-scoped fields. */
export interface Issue {
    tier: RuleTier;
    message: string;
    fieldKey?: string;
    partyId?: string;
    ruleId?: string;
}

/** Facts the engine needs to fill D fields. */
export interface DeriveContext {
    instanceId?: string;
    documentTypeCode?: string;
    status?: string;
    preparedBy?: string;
    verifiedBy?: string;
    fileRef?: string;
}

// ---------------------------------------------------------------------------------------------------------------
// Component contracts (shared by the form, the read view and the summary sheet)
// ---------------------------------------------------------------------------------------------------------------

export interface FieldInputProps {
    field: FieldDef;
    value: FieldValue | undefined;
    onChange: (next: FieldValue | undefined) => void;
    /** Issues for this field only. */
    issues?: Issue[];
    /** Whether the field is mandatory right now (M, or C with its condition true). */
    required: boolean;
    disabled?: boolean;
    /** internal party's entity field: the entity master list replaces free text. */
    entityOptions?: string[];
    id?: string;
}
