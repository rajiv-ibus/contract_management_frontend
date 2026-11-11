// The customer's sample field reference (iBUS_CMS_Sample_Field_Reference_v0_1.md, sections 3 and 4) turned into a
// FieldLibrary, cross-checked against the field master (688 fields). It is data in the shape the app already
// understands: nothing in the app depends on any of these keys.
//
// Sources, in order of authority:
//   - KEYS for the party-scoped fields come from the field master ("entity", "signatory", "reg_office", "name",
//     "pan", "cin", "gstin", "signing_capacity", "notice_address"). In the markdown these are the one-off
//     licensee_* / counterparty_* fields; here they repeat once per party on the document.
//   - Validation detail, allowed values and the Block / Warn / Flag tiers come from the markdown.
//
// Decisions worth knowing about:
//   - premises_address appears in the markdown as L3 on the warehouse agreement and as L2 on the leave and license
//     agreement. One key cannot sit at two levels, so it is a single L2 field on the PRC and PRP families, which
//     covers both types that list it.
//   - A "C" row whose condition the markdown does not state, and that no field in the sample can express, is kept as
//     "O" (optional) with the condition written in its description: advance_payment, cin, pan, board_resolution_ref.
//     Where a sensible condition is the only possible reading it is used and noted at the field (stamp_duty_payer,
//     stamp_state, arbitration_seat).
//   - "NOT STATED" is never an option: a mandatory or conditional field accepts it through allowNotStated. It is
//     switched off for fields that record something iBUS assigns rather than what the agreement says (title,
//     confidentiality class, entity, counterparty name, execution mode, attestation).
//   - premises_address, reg_office and notice_address are `address` fields (the field master's type), so the engine's
//     "Indian addresses carry a 6-digit PIN" check is the markdown's "Full address with PIN".
import type { Condition, DocumentValues, FieldDef, FieldLibrary, FieldValue, PartyValues, Rule } from "./model";
import { NOT_STATED } from "./engine";

// Document type IDs.
const WAREHOUSE = "IBUS-PRC-WH-IN";
const NDA = "IBUS-LEG-NDA-MUT";
const LEAVE_AND_LICENSE = "IBUS-PRP-LLA-OUT";

// Section themes, from the markdown's headings.
const IDENTITY = "Identity and classification";
const PARTIES = "Parties";
const STAMPING = "Stamping";
const TERM = "Term and key dates";
const RISK = "Risk and liability";
const TERMINATION = "Termination";
const COMPLIANCE = "Compliance and data";
const DISPUTES = "Governing law and disputes";
const EXECUTION = "Execution and formality";
const GOVERNANCE = "Sheet governance";

const STAMP_INSTRUMENT_USED: Condition = { field: "stamping_instrument", in: ["Physical stamp paper", "e-Stamp"] };

// The Indian State and Union Territory list behind "Indian State list" (stamp_state).
const INDIAN_STATES = [
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
    "Andaman and Nicobar Islands",
    "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi",
    "Jammu and Kashmir",
    "Ladakh",
    "Lakshadweep",
    "Puducherry",
];

const MUTUAL_OR_ONE_WAY = ["Mutual", "One-way"];

const fields: FieldDef[] = [
    // -----------------------------------------------------------------------------------------------------------
    // 3.1 Identity and classification (L1)
    // -----------------------------------------------------------------------------------------------------------
    {
        key: "document_title",
        label: "Document title",
        type: "text",
        level: "L1",
        req: "M",
        section: IDENTITY,
        minLength: 3,
        maxLength: 200,
        allowNotStated: false,
    },
    {
        key: "document_type_id",
        label: "Document type ID",
        type: "code",
        level: "L1",
        req: "D",
        section: IDENTITY,
        description: "Assigned by the register.",
        pattern: "IBUS-[A-Z]{3}-[A-Z0-9]{2,6}-[A-Z]{2,4}",
        patternHint: "IBUS-PRC-WH-IN",
        derive: "document_type_id",
    },
    {
        key: "instance_id",
        label: "Instance ID",
        type: "code",
        level: "L1",
        req: "D",
        section: IDENTITY,
        description: "Unique, never reissued.",
        patternHint: "<DTID>/<YYYY>/<NNNN>",
        derive: "instance_id",
    },
    {
        key: "parent_agreement_ref",
        label: "Parent or related agreement",
        type: "text",
        level: "L1",
        req: "O",
        section: IDENTITY,
        description: "Free text as named in the document, plus optional instance ID.",
    },
    {
        key: "amendment_lineage",
        label: "Amendment lineage",
        type: "text",
        level: "L1",
        req: "O",
        section: IDENTITY,
        description: "Instance IDs this supersedes or is superseded by.",
    },
    {
        key: "confidentiality_class",
        label: "Confidentiality classification",
        type: "enum",
        level: "L1",
        req: "M",
        section: IDENTITY,
        options: ["Public", "Internal", "Confidential", "Restricted"],
        allowNotStated: false,
    },

    // -----------------------------------------------------------------------------------------------------------
    // 3.2 Parties (L1). Party-scoped fields repeat once per party on the document.
    // -----------------------------------------------------------------------------------------------------------
    {
        key: "entity",
        label: "iBUS contracting entity",
        type: "text",
        level: "L1",
        req: "M",
        section: PARTIES,
        partyScope: "internal",
        description:
            "Must match an entity on the ratified entity master. Free text is not acceptable: nine entity-name " +
            "variants were found across the corpus for what should be a closed list.",
        allowNotStated: false,
    },
    {
        key: "name",
        label: "Counterparty legal name",
        type: "text",
        level: "L1",
        req: "M",
        section: PARTIES,
        partyScope: "external",
        minLength: 3,
        maxLength: 200,
        allowNotStated: false,
    },
    {
        key: "reg_office",
        label: "Counterparty registered office",
        type: "address",
        level: "L1",
        req: "M",
        section: PARTIES,
        partyScope: "external",
        description: "Must include a PIN code for an Indian address.",
    },
    {
        key: "signatory",
        label: "Signatory",
        type: "person",
        level: "L1",
        req: "M",
        section: PARTIES,
        partyScope: "all",
        description: "Name and designation of the person signing for this party.",
    },
    {
        key: "signing_capacity",
        label: "Signing capacity",
        type: "text",
        level: "L1",
        req: "M",
        section: PARTIES,
        partyScope: "external",
        description:
            "Designation of the person signing for the counterparty. Flag where the signing entity differs from " +
            "the contracting party.",
    },
    {
        key: "cin",
        label: "Counterparty CIN",
        type: "code",
        level: "L1",
        req: "O",
        section: PARTIES,
        partyScope: "external",
        description: "Mandatory where the counterparty is a company.",
        pattern: "[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}",
        patternHint: "21 characters: U12345MH2015PTC123456",
    },
    {
        key: "pan",
        label: "Counterparty PAN",
        type: "code",
        level: "L1",
        req: "O",
        section: PARTIES,
        partyScope: "external",
        description:
            "Exactly 10 characters. The length check is not optional: a 9-character PAN reached an executed " +
            "agreement in the corpus.",
        pattern: "[A-Z]{5}[0-9]{4}[A-Z]",
        patternHint: "10 characters: ABCDE1234F",
    },
    {
        key: "gstin",
        label: "Counterparty GSTIN",
        type: "code",
        level: "L1",
        req: "O",
        section: PARTIES,
        partyScope: "external",
        description: "The first two digits must be a valid State code.",
        pattern: "[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9][A-Z][0-9A-Z]",
        patternHint: "15 characters: 27ABCDE1234F1Z5",
    },
    {
        key: "notice_address",
        label: "Notice address",
        type: "address",
        level: "L1",
        req: "M",
        section: PARTIES,
        partyScope: "all",
        description:
            "Where notices go. Record NOT STATED where the clause points to addresses the document does not give.",
    },

    // -----------------------------------------------------------------------------------------------------------
    // 3.3 Stamping (L1)
    // -----------------------------------------------------------------------------------------------------------
    {
        key: "stamping_instrument",
        label: "Stamping instrument",
        type: "enum",
        level: "L1",
        req: "M",
        section: STAMPING,
        options: ["Physical stamp paper", "e-Stamp", "None"],
    },
    {
        key: "stamp_paper",
        label: "Stamp paper particulars",
        type: "text",
        level: "L1",
        req: "C",
        section: STAMPING,
        description: "Capture State, denomination, serial, vendor and issue date.",
        requiredWhen: { field: "stamping_instrument", equals: "Physical stamp paper" },
    },
    {
        key: "estamp_certificate",
        label: "e-Stamp certificate",
        type: "code",
        level: "L1",
        req: "C",
        section: STAMPING,
        pattern: "IN-[A-Z]{2}[0-9]{14}[A-Z]",
        patternHint: "IN-MH12345678901234A",
        requiredWhen: { field: "stamping_instrument", equals: "e-Stamp" },
    },
    {
        // The markdown marks this C without a condition. It only exists where a stamp instrument was used.
        key: "stamp_duty_payer",
        label: "Stamp duty payer",
        type: "text",
        level: "L1",
        req: "C",
        section: STAMPING,
        description: "Which party purchased it. Not assumed from the duty-allocation clause.",
        requiredWhen: STAMP_INSTRUMENT_USED,
    },
    {
        // The markdown marks this C without a condition. It only exists where a stamp instrument was used.
        key: "stamp_state",
        label: "Stamp State",
        type: "enum",
        level: "L1",
        req: "C",
        section: STAMPING,
        options: INDIAN_STATES,
        requiredWhen: STAMP_INSTRUMENT_USED,
    },

    // -----------------------------------------------------------------------------------------------------------
    // 3.4 Term and key dates (L1)
    // -----------------------------------------------------------------------------------------------------------
    {
        key: "execution_date",
        label: "Execution date",
        type: "date",
        level: "L1",
        req: "M",
        section: TERM,
        notInFuture: true,
    },
    {
        key: "effective_date",
        label: "Effective date",
        type: "date",
        level: "L1",
        req: "M",
        section: TERM,
        description:
            "Where the document does not define one, record NOT STATED rather than inferring. Five corpus " +
            "documents leave it undefined while the term runs from it.",
    },
    {
        key: "term_duration",
        label: "Term duration",
        type: "duration",
        level: "L1",
        req: "M",
        section: TERM,
        description: "Months or years. Must be derivable to an expiry date.",
        units: ["months", "years"],
    },
    {
        key: "term_expiry_date",
        label: "Term expiry date",
        type: "date",
        level: "L1",
        req: "D",
        section: TERM,
        description: "Effective date plus term. Blocked where either input is NOT STATED.",
        derive: "term_expiry_date",
    },
    {
        key: "lockin_duration",
        label: "Lock-in period",
        type: "duration",
        level: "L1",
        req: "O",
        section: TERM,
        description: "Must not exceed the term.",
    },
    {
        key: "renewal_type",
        label: "Renewal type",
        type: "enum",
        level: "L1",
        req: "M",
        section: TERM,
        options: ["Automatic", "Mutual", "Unilateral", "None"],
    },
    {
        key: "non_renewal_notice_days",
        label: "Non-renewal notice",
        type: "integer",
        level: "L1",
        req: "C",
        section: TERM,
        description: "Days. Mandatory where renewal is automatic.",
        requiredWhen: { field: "renewal_type", equals: "Automatic" },
    },

    // -----------------------------------------------------------------------------------------------------------
    // 3.5 Risk and liability (L1)
    // -----------------------------------------------------------------------------------------------------------
    {
        key: "liability_cap_supplier",
        label: "Liability cap, iBUS side",
        type: "formula",
        level: "L1",
        req: "M",
        section: RISK,
        description: "Formula or amount, or NOT STATED.",
    },
    {
        key: "liability_cap_client",
        label: "Liability cap, counterparty",
        type: "formula",
        level: "L1",
        req: "M",
        section: RISK,
        description:
            "Formula or amount, or NOT STATED. Flagged where one side is capped and the other is not: this " +
            "asymmetry appears in nine corpus documents.",
    },
    {
        key: "consequential_loss_exclusion",
        label: "Consequential loss exclusion",
        type: "enum",
        level: "L1",
        req: "M",
        section: RISK,
        options: ["Mutual", "One-way, iBUS protected", "One-way, counterparty protected"],
    },
    {
        key: "indemnity_mutuality",
        label: "Indemnity mutuality",
        type: "enum",
        level: "L1",
        req: "M",
        section: RISK,
        options: MUTUAL_OR_ONE_WAY,
    },
    {
        key: "insurance_requirement",
        label: "Insurance requirement",
        type: "text",
        level: "L1",
        req: "M",
        section: RISK,
        description: "Cover type and limit, or NOT STATED.",
    },
    {
        key: "unlimited_liability_heads",
        label: "Unlimited liability heads",
        type: "text",
        level: "L1",
        req: "O",
        section: RISK,
        description: "Carve-outs from the cap.",
    },

    // -----------------------------------------------------------------------------------------------------------
    // 3.6 Termination (L1)
    // -----------------------------------------------------------------------------------------------------------
    {
        key: "termination_convenience",
        label: "Termination for convenience, iBUS",
        type: "text",
        level: "L1",
        req: "M",
        section: TERMINATION,
        description: "Notice period, or NOT STATED.",
    },
    {
        key: "supplier_termination",
        label: "Termination for convenience, counterparty",
        type: "text",
        level: "L1",
        req: "M",
        section: TERMINATION,
        description: "Notice period, or NOT STATED. Flagged where only one side holds the right.",
    },
    {
        key: "termination_cause",
        label: "Termination for cause",
        type: "text",
        level: "L1",
        req: "M",
        section: TERMINATION,
        description: "Trigger and notice.",
    },
    {
        key: "cure_period",
        label: "Cure period",
        type: "duration",
        level: "L1",
        req: "M",
        section: TERMINATION,
        description:
            "A bare numeral is invalid: the unit must be present. Four corpus documents write " +
            '"within 30 (thirty)" with no unit.',
    },
    {
        key: "exit_fee_formula",
        label: "Exit or termination fee",
        type: "formula",
        level: "L1",
        req: "O",
        section: TERMINATION,
        description: "Formula or tiers.",
    },

    // -----------------------------------------------------------------------------------------------------------
    // 3.7 Compliance and data (L1)
    // -----------------------------------------------------------------------------------------------------------
    {
        key: "data_protection",
        label: "Data protection clause",
        type: "enum",
        level: "L1",
        req: "M",
        section: COMPLIANCE,
        description: "Mandatory review where NOT STATED and the document processes personal data.",
        options: ["DPDP-aligned", "Generic"],
    },
    {
        key: "breach_notification",
        label: "Breach notification",
        type: "duration",
        level: "L1",
        req: "C",
        section: COMPLIANCE,
        description: "Mandatory where a data protection clause exists.",
        requiredWhen: { field: "data_protection", in: ["DPDP-aligned", "Generic"] },
    },
    {
        key: "confidentiality_obligation",
        label: "Confidentiality obligation",
        type: "enum",
        level: "L1",
        req: "M",
        section: COMPLIANCE,
        options: MUTUAL_OR_ONE_WAY,
    },
    {
        key: "confidentiality_survival_period",
        label: "Confidentiality survival",
        type: "duration",
        level: "L1",
        req: "M",
        section: COMPLIANCE,
        description: "Period, or NOT STATED.",
    },
    {
        key: "anti_corruption_warranty",
        label: "Anti-corruption warranty",
        type: "enum",
        level: "L1",
        req: "M",
        section: COMPLIANCE,
        options: MUTUAL_OR_ONE_WAY,
    },

    // -----------------------------------------------------------------------------------------------------------
    // 3.8 Governing law and disputes (L1)
    // -----------------------------------------------------------------------------------------------------------
    {
        key: "governing_law",
        label: "Governing law",
        type: "text",
        level: "L1",
        req: "M",
        section: DISPUTES,
        description: "Country, and State where stated.",
    },
    {
        key: "jurisdiction",
        label: "Jurisdiction",
        type: "text",
        level: "L1",
        req: "M",
        section: DISPUTES,
        description: "Court and city, or NOT STATED.",
    },
    {
        key: "arbitration_tribunal",
        label: "Arbitration tribunal",
        type: "text",
        level: "L1",
        req: "O",
        section: DISPUTES,
        description:
            "Composition and appointing authority. Flag unilateral appointment by one party: found in two corpus " +
            "documents.",
    },
    {
        // The markdown marks this C without a condition. A seat only exists where there is an arbitration tribunal.
        key: "arbitration_seat",
        label: "Arbitration seat",
        type: "text",
        level: "L1",
        req: "C",
        section: DISPUTES,
        description: "City. Warn where the seat city differs from the jurisdiction city.",
        requiredWhen: { field: "arbitration_tribunal", present: true },
    },
    {
        key: "dispute_escalation",
        label: "Escalation before arbitration",
        type: "text",
        level: "L1",
        req: "O",
        section: DISPUTES,
        description: "Mechanism and period.",
    },

    // -----------------------------------------------------------------------------------------------------------
    // 3.9 Execution and formality (L1)
    // -----------------------------------------------------------------------------------------------------------
    {
        key: "execution_mode",
        label: "Execution mode",
        type: "enum",
        level: "L1",
        req: "M",
        section: EXECUTION,
        options: ["Wet signature", "Digital signature", "Mixed", "Accepted by conduct"],
        allowNotStated: false,
    },
    {
        key: "execution_completeness",
        label: "Execution completeness",
        type: "enum",
        level: "L1",
        req: "D",
        section: EXECUTION,
        description: "Derived from the signature, date and witness fields.",
        options: ["Fully executed", "Partially executed", "Not executed"],
        derive: "execution_completeness",
    },
    {
        key: "execution_place",
        label: "Execution place",
        type: "text",
        level: "L1",
        req: "M",
        section: EXECUTION,
        description: "City.",
    },
    {
        key: "company_seal",
        label: "Company seal",
        type: "text",
        level: "L1",
        req: "O",
        section: EXECUTION,
        description: "Which parties applied a seal and where.",
    },
    {
        key: "page_initialling",
        label: "Page initialling",
        type: "text",
        level: "L1",
        req: "O",
        section: EXECUTION,
        description: "Count, colour, placement, and whether attributed.",
    },
    {
        key: "board_resolution_ref",
        label: "Board resolution reference",
        type: "text",
        level: "L1",
        req: "O",
        section: EXECUTION,
        description: "Date of the authorising resolution. Mandatory where the signatory acts for a company.",
    },
    {
        key: "signature_script",
        label: "Signature script",
        type: "enum",
        level: "L1",
        req: "O",
        section: EXECUTION,
        description: "Affects OCR handling and identity verification.",
        options: ["Latin", "Devanagari", "Other"],
    },
    {
        key: "manuscript_amendments",
        label: "Manuscript amendments",
        type: "text",
        level: "L1",
        req: "O",
        section: EXECUTION,
        description: "Clause affected, nature of the change, and whether initialled.",
    },

    // -----------------------------------------------------------------------------------------------------------
    // 3.10 Sheet governance (L1)
    // -----------------------------------------------------------------------------------------------------------
    {
        key: "scanned_pdf_ref",
        label: "Scanned PDF reference",
        type: "code",
        level: "L1",
        req: "D",
        section: GOVERNANCE,
        description: "Storage reference plus SHA-256 of the source document.",
        derive: "scanned_pdf_ref",
    },
    {
        key: "prepared_by",
        label: "Prepared by",
        type: "text",
        level: "L1",
        req: "D",
        section: GOVERNANCE,
        description: "From the authenticated Maker.",
        derive: "prepared_by",
    },
    {
        key: "verified_by",
        label: "Legal reviewed by",
        type: "text",
        level: "L1",
        req: "D",
        section: GOVERNANCE,
        description: "From the authenticated Checker.",
        derive: "verified_by",
    },
    {
        key: "attestation_ack",
        label: "Attestation acknowledged",
        type: "boolean",
        level: "L1",
        req: "M",
        section: GOVERNANCE,
        description: "Must be true before approval.",
        allowNotStated: false,
        phase: "approve",
    },
    {
        key: "sheet_status",
        label: "Sheet status",
        type: "enum",
        level: "L1",
        req: "D",
        section: GOVERNANCE,
        description: "Mirrors workflow status.",
        options: ["Draft", "Approval pending", "Rejected", "Approved", "Invalid"],
        derive: "sheet_status",
    },

    // -----------------------------------------------------------------------------------------------------------
    // 4.1 IBUS-PRC-WH-IN: Warehouse service agreement
    // -----------------------------------------------------------------------------------------------------------
    {
        // L3 in the warehouse table, L2 in the leave and license table: one key, so one L2 field on both families.
        key: "premises_address",
        label: "Premises address",
        type: "address",
        level: "L2",
        req: "M",
        section: "Premises",
        description: "Full address with PIN. For a warehouse agreement this is the warehouse address.",
        appliesTo: ["PRC", "PRP"],
    },
    {
        key: "storage_capacity",
        label: "Storage area or capacity",
        type: "text",
        level: "L3",
        req: "M",
        section: "Warehouse and goods",
        description: "Area, volume or pallet positions.",
        appliesTo: [WAREHOUSE],
    },
    {
        key: "goods_description",
        label: "Goods stored",
        type: "text",
        level: "L3",
        req: "M",
        section: "Warehouse and goods",
        description: "Description and indicative value.",
        appliesTo: [WAREHOUSE],
    },
    {
        key: "goods_risk",
        label: "Risk of loss or damage",
        type: "enum",
        level: "L3",
        req: "M",
        section: "Warehouse and goods",
        options: ["iBUS", "Service Provider"],
        appliesTo: [WAREHOUSE],
    },
    {
        key: "site_access",
        label: "Client access rights",
        type: "text",
        level: "L3",
        req: "M",
        section: "Warehouse and goods",
        description: "Hours and notice, or NOT STATED.",
        appliesTo: [WAREHOUSE],
    },
    {
        key: "inventory_reconciliation",
        label: "Inventory and reconciliation",
        type: "text",
        level: "L3",
        req: "O",
        section: "Warehouse and goods",
        description: "Frequency and format.",
        appliesTo: [WAREHOUSE],
    },
    {
        key: "monthly_fee",
        label: "Monthly fee",
        type: "money",
        level: "L2",
        req: "M",
        section: "Fees and payment",
        description: "INR. Positive.",
        currencies: ["INR"],
        min: 0.01,
        appliesTo: ["PRC"],
    },
    {
        // The markdown marks this C without a condition; the field master has it optional.
        key: "advance_payment",
        label: "Advance payment",
        type: "money",
        level: "L2",
        req: "O",
        section: "Fees and payment",
        description: "Months and amount. Flag where the advance exceeds three months and no security is held.",
        currencies: ["INR"],
        appliesTo: ["PRC"],
    },
    {
        key: "advance_recovery",
        label: "Advance recovery on termination",
        type: "text",
        level: "L2",
        req: "C",
        section: "Fees and payment",
        description: "Mandatory where an advance is paid.",
        requiredWhen: { field: "advance_payment", present: true },
        appliesTo: ["PRC"],
    },
    {
        key: "payment_term_days",
        label: "Payment term",
        type: "integer",
        level: "L2",
        req: "M",
        section: "Fees and payment",
        description: "Days from invoice approval.",
        min: 0,
        max: 120,
        appliesTo: ["PRC"],
    },

    // -----------------------------------------------------------------------------------------------------------
    // 4.2 IBUS-LEG-NDA-MUT: Mutual non-disclosure agreement
    // -----------------------------------------------------------------------------------------------------------
    {
        key: "purpose",
        label: "Purpose",
        type: "text",
        level: "L2",
        req: "M",
        section: "Purpose and scope",
        description:
            "Minimum 20 characters and must name the opportunity. A generic phrase is a validation failure: " +
            '"certain business opportunity amongst themselves" reached a stamped agreement in the corpus.',
        minLength: 20,
        appliesTo: ["LEG"],
    },
    {
        key: "confidential_information_definition",
        label: "Confidential information definition",
        type: "text",
        level: "L2",
        req: "M",
        section: "Purpose and scope",
        description: "Scope and form.",
        appliesTo: ["LEG"],
    },
    {
        key: "marking_requirement",
        label: "Marking requirement",
        type: "enum",
        level: "L2",
        req: "M",
        section: "Purpose and scope",
        options: ["Marked only", "All non-public"],
        appliesTo: ["LEG"],
    },
    {
        key: "confidentiality_exceptions",
        label: "Exceptions",
        type: "text",
        level: "L2",
        req: "M",
        section: "Purpose and scope",
        description:
            "Must include public domain, prior knowledge, independent development and compelled disclosure, or " +
            "record which are absent.",
        appliesTo: ["LEG"],
    },
    {
        key: "employee_non_solicitation",
        label: "Employee non-solicitation",
        type: "duration",
        level: "L2",
        req: "O",
        section: "Non-solicitation",
        description: "Period from execution.",
        appliesTo: ["LEG"],
    },
    {
        key: "customer_non_solicitation",
        label: "Customer non-solicitation",
        type: "duration",
        level: "L2",
        req: "O",
        section: "Non-solicitation",
        description:
            "Period. Flagged where no period is stated: an unbounded restriction appears in three corpus documents.",
        allowNotStated: true,
        appliesTo: ["LEG"],
    },
    {
        key: "return_or_destruction",
        label: "Return or destruction",
        type: "text",
        level: "L2",
        req: "M",
        section: "Return and ownership",
        description: "Trigger and method.",
        appliesTo: ["LEG"],
    },
    {
        key: "developed_ip_ownership",
        label: "Developed IP ownership",
        type: "text",
        level: "L3",
        req: "O",
        section: "Return and ownership",
        description:
            "Review required if present. An NDA assigning independently developed work product contradicts its " +
            "own independent-development exception.",
        appliesTo: [NDA],
    },

    // -----------------------------------------------------------------------------------------------------------
    // 4.3 IBUS-PRP-LLA-OUT: Leave and license, rent-paying
    // (premises_address is the single L2 field above.)
    // -----------------------------------------------------------------------------------------------------------
    {
        key: "premises_area",
        label: "Premises area",
        type: "text",
        level: "L3",
        req: "M",
        section: "Premises",
        description: "Square feet, carpet or built-up stated.",
        appliesTo: [LEAVE_AND_LICENSE],
    },
    {
        key: "license_fee",
        label: "Licence fee",
        type: "money",
        level: "L2",
        req: "M",
        section: "Fees and deposit",
        description: "INR, with period. The period is mandatory: one corpus document states an amount with no period.",
        currencies: ["INR"],
        periods: ["per month", "per quarter", "per year"],
        appliesTo: ["PRP"],
    },
    {
        key: "fee_escalation",
        label: "Fee escalation",
        type: "text",
        level: "L2",
        req: "O",
        section: "Fees and deposit",
        description: "Percentage and frequency.",
        appliesTo: ["PRP"],
    },
    {
        key: "security_deposit",
        label: "Security deposit",
        type: "money",
        level: "L2",
        req: "O",
        section: "Fees and deposit",
        description:
            "Warned where the deposit exceeds twelve times the monthly fee: a 14x ratio appears in the corpus.",
        currencies: ["INR"],
        appliesTo: ["PRP"],
    },
    {
        key: "security_deposit_refund_days",
        label: "Deposit refund period",
        type: "integer",
        level: "L2",
        req: "C",
        section: "Fees and deposit",
        description: "Days. Mandatory where a deposit is held.",
        requiredWhen: { field: "security_deposit", present: true },
        appliesTo: ["PRP"],
    },
    {
        key: "security_deposit_deductions",
        label: "Deposit deductions",
        type: "text",
        level: "L2",
        req: "C",
        section: "Fees and deposit",
        description: 'Heads of deduction. Open-ended wording such as "damages or costs" should be flagged.',
        requiredWhen: { field: "security_deposit", present: true },
        appliesTo: ["PRP"],
    },
    {
        key: "registration_status",
        label: "Registration status",
        type: "enum",
        level: "L2",
        req: "M",
        section: "Registration and grant",
        description: "Mandatory review where the term exceeds 11 months and the status is unregistered.",
        options: ["Registered", "Unregistered"],
        appliesTo: ["PRP"],
    },
    {
        key: "licensor_lockin",
        label: "Lock-in, licensor side",
        type: "duration",
        level: "L3",
        req: "O",
        section: "Registration and grant",
        description: "Must not exceed the term.",
        appliesTo: [LEAVE_AND_LICENSE],
    },
    {
        key: "grant_exclusivity",
        label: "Exclusivity",
        type: "enum",
        level: "L2",
        req: "M",
        section: "Registration and grant",
        options: ["Exclusive", "Non-exclusive"],
        appliesTo: ["PRP"],
    },
];

const rules: Rule[] = [
    {
        id: "attestation_not_true",
        tier: "BLOCK",
        message: "The attestation must be acknowledged (true) before the sheet can be approved.",
        kind: "when",
        when: { field: "attestation_ack", equals: false },
    },
    {
        id: "lockin_exceeds_term",
        // WARN, not BLOCK: the engine compares durations in days (month = 30, year = 365), so a lock-in and a term of
        // the same length in different units (12 months and 1 year) would otherwise refuse a correct document.
        tier: "WARN",
        message: "The lock-in period is longer than the term. It must not exceed the term.",
        kind: "compare",
        left: "lockin_duration",
        op: "<=",
        right: "term_duration",
    },
    {
        id: "licensor_lockin_exceeds_term",
        tier: "WARN",
        message: "The licensor's lock-in is longer than the term. It must not exceed the term.",
        kind: "compare",
        left: "licensor_lockin",
        op: "<=",
        right: "term_duration",
    },
    {
        id: "security_deposit_over_12x",
        tier: "WARN",
        message: "The security deposit is more than twelve times the licence fee. Check it against the agreement.",
        kind: "ratio",
        field: "security_deposit",
        of: "license_fee",
        max: 12,
    },
    {
        id: "developed_ip_review",
        tier: "WARN",
        message:
            "The agreement assigns developed IP. This contradicts the independent-development exception and needs " +
            "legal review.",
        kind: "when",
        when: { field: "developed_ip_ownership", present: true },
    },
    {
        id: "liability_cap_one_sided",
        tier: "FLAG",
        message: "Liability is capped on one side only. The other side is uncapped (NOT STATED).",
        kind: "one_sided",
        a: "liability_cap_supplier",
        b: "liability_cap_client",
    },
    {
        id: "termination_convenience_one_sided",
        tier: "FLAG",
        message: "Only one side holds a right to terminate for convenience.",
        kind: "one_sided",
        a: "termination_convenience",
        b: "supplier_termination",
    },
    {
        id: "customer_non_solicitation_unbounded",
        tier: "FLAG",
        message: "No period is stated for the customer non-solicitation. The restriction is unbounded.",
        kind: "not_stated",
        field: "customer_non_solicitation",
    },
];

// The family map is provisional: the customer says it is not yet ratified (nine families, five with one member). The
// codes come from the middle part of the document type IDs, so they will move if the map is revised.
export const sampleLibrary: FieldLibrary = {
    version: 1,
    families: [
        { code: "PRC", name: "Procurement and services" },
        { code: "LEG", name: "Legal and confidentiality" },
        { code: "PRP", name: "Property and premises" },
    ],
    documentTypes: [
        {
            code: WAREHOUSE,
            name: "Warehouse service agreement",
            family: "PRC",
            parties: [
                { role: "iBUS", internal: true },
                { role: "Service Provider", internal: false },
            ],
        },
        {
            code: NDA,
            name: "Mutual non-disclosure agreement",
            family: "LEG",
            parties: [
                { role: "iBUS", internal: true },
                { role: "Counterparty", internal: false },
            ],
        },
        {
            code: LEAVE_AND_LICENSE,
            name: "Leave and license, rent-paying",
            family: "PRP",
            parties: [
                { role: "iBUS (Licensee)", internal: true },
                { role: "Licensor", internal: false },
            ],
        },
    ],
    // Placeholder. The ratified entity master is still awaited from the customer: nine name variants for the iBUS
    // entities are in circulation in the corpus. These two names are the ones used in the CMS architecture document.
    entityMaster: ["iBUS Network", "iBUS Infra"],
    fields,
    rules,
};

// ---------------------------------------------------------------------------------------------------------------
// Sample values. Every name, address, PAN, CIN and GSTIN below is fictitious (the identifiers satisfy the patterns
// but are obviously made up).
// ---------------------------------------------------------------------------------------------------------------

const slug = (role: string) =>
    role
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

function party(role: string, values: Record<string, FieldValue>): PartyValues {
    return { id: `party-${slug(role)}`, role, values };
}

const months = (value: string) => ({ value, unit: "months" as const });
const days = (value: string) => ({ value, unit: "days" as const });
const years = (value: string) => ({ value, unit: "years" as const });
const inr = (amount: string, period?: string) => ({ amount, currency: "INR", ...(period ? { period } : {}) });

// Factories, so every sample call hands out its own nested objects (a consumer may edit them in place).
const ibusSignatory = () => ({ name: "Meera Raghavan", designation: "Authorised Signatory" });
const ibusNotice = () => ({
    line1: "4th Floor, Harbour Point, Lower Parel",
    city: "Mumbai",
    state: "Maharashtra",
    pin: "400013",
    country: "India",
});

/** The L1 answers every sample shares. Each sample overrides what makes it different. */
function baseFields(
    title: string,
    overrides: Record<string, FieldValue> = {},
    leaveOut: string[] = [],
): Record<string, FieldValue> {
    const answers: Record<string, FieldValue> = {
        document_title: title,
        confidentiality_class: "Confidential",
        stamping_instrument: "e-Stamp",
        estamp_certificate: "IN-MH12345678901234A",
        stamp_duty_payer: "iBUS",
        stamp_state: "Maharashtra",
        execution_date: "2025-04-02",
        effective_date: "2025-04-15",
        term_duration: months("36"),
        lockin_duration: months("12"),
        renewal_type: "Automatic",
        non_renewal_notice_days: "90",
        liability_cap_supplier: "12 months of fees paid",
        liability_cap_client: "12 months of fees paid",
        consequential_loss_exclusion: "Mutual",
        indemnity_mutuality: "Mutual",
        insurance_requirement: "Commercial general liability, INR 5,00,00,000 per occurrence",
        termination_convenience: "90 days written notice",
        supplier_termination: "90 days written notice",
        termination_cause: "Material breach not cured within the cure period, on 30 days written notice",
        cure_period: days("30"),
        data_protection: "DPDP-aligned",
        breach_notification: days("3"),
        confidentiality_obligation: "Mutual",
        confidentiality_survival_period: years("3"),
        anti_corruption_warranty: "Mutual",
        governing_law: "India, State of Maharashtra",
        jurisdiction: "Courts at Mumbai",
        arbitration_tribunal: "Sole arbitrator appointed jointly by the parties",
        arbitration_seat: "Mumbai",
        dispute_escalation: "Senior management meeting within 15 days before arbitration",
        execution_mode: "Wet signature",
        execution_place: "Mumbai",
        // The Checker's answer (phase "approve"): these samples are shown at or after approval. ndaDraft omits it.
        attestation_ack: true,
        ...overrides,
    };
    for (const key of leaveOut) delete answers[key];
    return answers;
}

const internalParty = (role: string, entity: string) =>
    party(role, { entity, signatory: ibusSignatory(), notice_address: ibusNotice() });

export const sampleValues: {
    warehouse(): DocumentValues;
    nda(): DocumentValues;
    leaveAndLicense(): DocumentValues;
    leaveAndLicenseWithIssues(): DocumentValues;
    ndaDraft(): DocumentValues;
} = {
    warehouse() {
        return {
            fields: baseFields("Warehouse Service Agreement with Northgate Logistics Private Limited", {
                premises_address: {
                    line1: "Survey No. 112, Bhiwandi Logistics Park",
                    city: "Bhiwandi",
                    state: "Maharashtra",
                    pin: "421302",
                    country: "India",
                },
                storage_capacity: "2,400 pallet positions across 45,000 sq ft",
                goods_description: "Packaged consumer electronics, indicative value INR 8,00,00,000",
                goods_risk: "Service Provider",
                site_access: "Monday to Saturday, 9:00 to 18:00, on 24 hours notice",
                inventory_reconciliation: "Monthly cycle count, reported in spreadsheet format",
                monthly_fee: inr("185000.00"),
                advance_payment: inr("555000.00"),
                advance_recovery:
                    "Advance is adjusted against the final three invoices or refunded within 30 days of exit",
                payment_term_days: "45",
            }),
            parties: [
                internalParty("iBUS", "iBUS Network"),
                party("Service Provider", {
                    name: "Northgate Logistics Private Limited",
                    reg_office: {
                        line1: "Plot 7, Sector 12, Industrial Estate",
                        city: "Pune",
                        state: "Maharashtra",
                        pin: "411019",
                        country: "India",
                    },
                    signatory: { name: "Arvind Kulkarni", designation: "Director" },
                    signing_capacity: "Director",
                    cin: "U12345MH2015PTC123456",
                    pan: "ABCDE1234F",
                    gstin: "27ABCDE1234F1Z5",
                    notice_address: {
                        line1: "Plot 7, Sector 12, Industrial Estate",
                        city: "Pune",
                        state: "Maharashtra",
                        pin: "411019",
                        country: "India",
                    },
                }),
            ],
            custom: [],
        };
    },

    nda() {
        return {
            fields: baseFields(
                "Mutual Non-Disclosure Agreement with Lakeview Analytics LLP",
                {
                    stamping_instrument: "Physical stamp paper",
                    stamp_paper: "Maharashtra, INR 500, serial no. AB 000123, vendor Fort Stamps, issued 28 March 2025",
                    term_duration: months("24"),
                    renewal_type: "None",
                    purpose:
                        "Evaluating a proposed joint bid for the metro-station connectivity tender issued in March 2025",
                    confidential_information_definition:
                        "All non-public technical, commercial and financial information disclosed in any form",
                    marking_requirement: "All non-public",
                    confidentiality_exceptions:
                        "Public domain, prior knowledge, independent development and compelled disclosure",
                    employee_non_solicitation: months("12"),
                    customer_non_solicitation: NOT_STATED,
                    return_or_destruction:
                        "On written request or on expiry, by return or certified destruction within 15 days",
                },
                ["estamp_certificate", "lockin_duration", "non_renewal_notice_days"],
            ),
            parties: [
                internalParty("iBUS", "iBUS Infra"),
                party("Counterparty", {
                    name: "Lakeview Analytics LLP",
                    reg_office: {
                        line1: "12, Residency Road",
                        city: "Bengaluru",
                        state: "Karnataka",
                        pin: "560025",
                        country: "India",
                    },
                    signatory: { name: "Divya Menon", designation: "Designated Partner" },
                    signing_capacity: "Designated Partner",
                    pan: "FGHIJ5678K",
                    notice_address: {
                        line1: "12, Residency Road",
                        city: "Bengaluru",
                        state: "Karnataka",
                        pin: "560025",
                        country: "India",
                    },
                }),
            ],
            custom: [],
        };
    },

    leaveAndLicense() {
        return {
            fields: baseFields(
                "Leave and License Agreement for Office Premises, Andheri East",
                {
                    term_duration: months("33"),
                    lockin_duration: months("12"),
                    renewal_type: "Mutual",
                    premises_address: {
                        line1: "Unit 304, Sunrise Business Centre, Andheri East",
                        city: "Mumbai",
                        state: "Maharashtra",
                        pin: "400069",
                        country: "India",
                    },
                    premises_area: "4,200 sq ft carpet area",
                    license_fee: inr("350000.00", "per month"),
                    fee_escalation: "5 percent every 12 months",
                    security_deposit: inr("2100000.00"),
                    security_deposit_refund_days: "30",
                    security_deposit_deductions:
                        "Unpaid licence fee, utility dues and cost of repairing damage beyond normal wear",
                    registration_status: "Registered",
                    licensor_lockin: months("12"),
                    grant_exclusivity: "Exclusive",
                },
                ["non_renewal_notice_days"],
            ),
            parties: [
                internalParty("iBUS (Licensee)", "iBUS Network"),
                party("Licensor", {
                    name: "Sunrise Estates Private Limited",
                    reg_office: {
                        line1: "Sunrise House, Station Road, Andheri East",
                        city: "Mumbai",
                        state: "Maharashtra",
                        pin: "400069",
                        country: "India",
                    },
                    signatory: { name: "Rohan Deshmukh", designation: "Managing Director" },
                    signing_capacity: "Managing Director",
                    cin: "U12345MH2015PTC123456",
                    pan: "KLMNO9012P",
                    gstin: "27KLMNO9012P1Z7",
                    notice_address: {
                        line1: "Sunrise House, Station Road, Andheri East",
                        city: "Mumbai",
                        state: "Maharashtra",
                        pin: "400069",
                        country: "India",
                    },
                }),
            ],
            custom: [],
        };
    },

    leaveAndLicenseWithIssues() {
        const base = sampleValues.leaveAndLicense();
        return {
            ...base,
            fields: {
                ...base.fields,
                // The agreement leaves these points open: recorded as findings, not blanks.
                effective_date: NOT_STATED,
                insurance_requirement: NOT_STATED,
                indemnity_mutuality: NOT_STATED,
                // The licensor is not capped; iBUS is. One side only.
                liability_cap_supplier: NOT_STATED,
                liability_cap_client: "6 months of licence fees",
                // 1,500,000 deposit on an 85,000 monthly fee is about 17.6 times.
                license_fee: inr("85000.00", "per month"),
                security_deposit: inr("1500000.00"),
                security_deposit_deductions: "Damages or costs",
                registration_status: "Unregistered",
            },
        };
    },

    ndaDraft() {
        return {
            fields: {
                document_title: "Mutual NDA with Lakeview Analytics",
                confidentiality_class: "Confidential",
                stamping_instrument: "e-Stamp",
                execution_date: "2025-04-02",
                purpose: "Discussions",
                marking_requirement: "All non-public",
                customer_non_solicitation: months("12"),
            },
            parties: [
                party("iBUS", { entity: "iBUS Infra" }),
                party("Counterparty", { name: "Lakeview Analytics LLP", pan: "FGHIJ5678" }),
            ],
            custom: [],
        };
    },
};
