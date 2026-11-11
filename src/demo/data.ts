// Sample data for the UI prototype. Names, companies and emails are fictitious. Document values are built from the
// customer's sample field reference (see src/templates/sampleLibrary.ts), so every document uses the real field model.
import { sampleLibrary, sampleValues } from "@/templates/sampleLibrary";
import type { DocumentValues, FieldLibrary, FieldValue } from "@/templates/model";

import type { ContractDocument, DemoRole, Membership, NotificationRecipient, Project, User } from "./types";

export const users: User[] = [
    {
        id: "u1",
        name: "Kumar Raj",
        email: "kumar.raj@example.com",
        status: "ACTIVE",
        isSuperAdmin: true,
        lastLoginAt: "2026-11-10T09:12:00Z",
    },
    {
        id: "u2",
        name: "Priya Sharma",
        email: "priya.sharma@example.com",
        status: "ACTIVE",
        isSuperAdmin: false,
        lastLoginAt: "2026-11-10T08:40:00Z",
    },
    {
        id: "u3",
        name: "Ravi Kumar",
        email: "ravi.kumar@example.com",
        status: "ACTIVE",
        isSuperAdmin: false,
        lastLoginAt: "2026-11-10T10:05:00Z",
    },
    {
        id: "u4",
        name: "Anitha Devi",
        email: "anitha.devi@example.com",
        status: "ACTIVE",
        isSuperAdmin: false,
        lastLoginAt: "2026-11-09T16:30:00Z",
    },
    {
        id: "u5",
        name: "Suresh Babu",
        email: "suresh.babu@example.com",
        status: "ACTIVE",
        isSuperAdmin: false,
        lastLoginAt: "2026-11-08T11:00:00Z",
    },
    { id: "u6", name: "Meena Iyer", email: "meena.iyer@example.com", status: "INVITED", isSuperAdmin: false },
    {
        id: "u7",
        name: "Arjun Nair",
        email: "arjun.nair@example.com",
        status: "ACTIVE",
        isSuperAdmin: false,
        lastLoginAt: "2026-11-07T14:20:00Z",
    },
    {
        id: "u8",
        name: "Deepa Menon",
        email: "deepa.menon@example.com",
        status: "DEACTIVATED",
        isSuperAdmin: false,
        lastLoginAt: "2026-10-02T09:00:00Z",
    },
];

export const projects: Project[] = [
    {
        id: "p1",
        code: "HOSP",
        name: "Hospitality",
        description: "Property agreements, service agreements and NDAs for hospitality",
        active: true,
    },
    {
        id: "p2",
        code: "PROC",
        name: "Procurement",
        description: "Purchase, supply and warehousing agreements",
        active: true,
    },
    {
        id: "p3",
        code: "FAC",
        name: "Facilities",
        description: "Building maintenance and facility services",
        active: true,
    },
    { id: "p4", code: "LEGAL", name: "Legal", description: "Legal and compliance agreements", active: false },
];

export const memberships: Membership[] = [
    { userId: "u2", projectId: "p1", isAdmin: true, canMake: false, canCheck: true },
    { userId: "u3", projectId: "p1", isAdmin: false, canMake: true, canCheck: false },
    { userId: "u4", projectId: "p1", isAdmin: false, canMake: false, canCheck: true },
    { userId: "u5", projectId: "p1", isAdmin: false, canMake: true, canCheck: true },
    { userId: "u6", projectId: "p1", isAdmin: false, canMake: true, canCheck: false },
    { userId: "u1", projectId: "p2", isAdmin: true, canMake: true, canCheck: true },
    { userId: "u3", projectId: "p2", isAdmin: false, canMake: false, canCheck: true },
    { userId: "u7", projectId: "p2", isAdmin: false, canMake: true, canCheck: false },
    { userId: "u2", projectId: "p3", isAdmin: false, canMake: true, canCheck: true },
];

/** Every project starts with the sample field library. A project Admin saves changes as a new version. */
export const libraries: Record<string, FieldLibrary> = {
    p1: sampleLibrary,
    p2: sampleLibrary,
    p3: sampleLibrary,
    p4: sampleLibrary,
};

export const notificationRecipients: NotificationRecipient[] = [
    { id: "r1", projectId: "p1", email: "legal.team@example.com", name: "Legal team" },
    { id: "r2", projectId: "p1", email: "finance.contracts@example.com", name: "Finance – contracts" },
    { id: "r3", projectId: "p2", email: "procurement.head@example.com", name: "Procurement head" },
];

// ---------------------------------------------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------------------------------------------

const WH = "IBUS-PRC-WH-IN";
const NDA = "IBUS-LEG-NDA-MUT";
const LLA = "IBUS-PRP-LLA-OUT";

const hash = (seed: string) => (seed.repeat(16) + "0".repeat(64)).slice(0, 64);
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

/** A copy of the sample values with changes applied. */
function variant(base: DocumentValues, change: (v: DocumentValues) => void): DocumentValues {
    const v = clone(base);
    change(v);
    return v;
}

const setField = (v: DocumentValues, key: string, value: FieldValue) => {
    v.fields[key] = value;
};

/** The other side of the agreement: the party that is not iBUS. */
function setCounterparty(v: DocumentValues, name: string) {
    const party = v.parties.find((p) => !/^ibus/i.test(p.role));
    if (party) party.values.name = name;
}

const attestation = (byId: string, at: string) => ({ byId, at, items: ["Attestation acknowledged"] });

const lla = () => sampleValues.leaveAndLicense();
const llaIssues = () => sampleValues.leaveAndLicenseWithIssues();

export const documents: ContractDocument[] = [
    {
        id: "d1",
        projectId: "p1",
        typeCode: LLA,
        title: "Andheri East Office Leave and License",
        status: "APPROVAL_PENDING",
        instanceId: `${LLA}/2026/0002`,
        values: llaIssues(),
        currentVersionNo: 2,
        createdById: "u3",
        createdAt: "2026-11-03T09:20:00Z",
        updatedAt: "2026-11-06T15:10:00Z",
        versions: [
            {
                no: 1,
                submittedBy: "u3",
                submittedAt: "2026-11-04T11:00:00Z",
                values: variant(llaIssues(), (v) => setField(v, "term_duration", { value: "24", unit: "months" })),
                fileName: "andheri-leave-and-license.pdf",
                fileSizeKb: 1840,
                fileHash: hash("3fa9"),
            },
            {
                no: 2,
                submittedBy: "u3",
                submittedAt: "2026-11-06T15:10:00Z",
                values: llaIssues(),
                fileName: "andheri-leave-and-license-v2.pdf",
                fileSizeKb: 1856,
                fileHash: hash("8c41"),
            },
        ],
        comments: [
            {
                id: "m1",
                versionNo: 1,
                authorId: "u4",
                type: "REJECTION",
                text: "The term is wrong. The signed agreement runs for three years, not two.",
                createdAt: "2026-11-05T10:30:00Z",
            },
            {
                id: "m2",
                versionNo: 1,
                authorId: "u3",
                type: "COMMENT",
                text: "Thanks, corrected the term to 36 months. Resubmitting as version 2.",
                createdAt: "2026-11-06T15:05:00Z",
                replyToId: "m1",
            },
        ],
        activity: [
            { at: "2026-11-03T09:20:00Z", byId: "u3", action: "Created draft" },
            { at: "2026-11-04T11:00:00Z", byId: "u3", action: "Submitted version 1" },
            { at: "2026-11-05T10:30:00Z", byId: "u4", action: "Rejected version 1", detail: "The term is wrong" },
            { at: "2026-11-06T14:50:00Z", byId: "u3", action: "Reopened for correction" },
            { at: "2026-11-06T15:10:00Z", byId: "u3", action: "Submitted version 2" },
        ],
    },
    {
        id: "d2",
        projectId: "p1",
        typeCode: WH,
        title: "Northgate Logistics Warehouse Services",
        status: "APPROVED",
        instanceId: `${WH}/2026/0001`,
        values: sampleValues.warehouse(),
        currentVersionNo: 1,
        approvedVersionNo: 1,
        attestation: attestation("u2", "2026-10-30T12:00:00Z"),
        createdById: "u5",
        createdAt: "2026-10-28T10:00:00Z",
        updatedAt: "2026-10-30T12:00:00Z",
        versions: [
            {
                no: 1,
                submittedBy: "u5",
                submittedAt: "2026-10-29T09:00:00Z",
                values: sampleValues.warehouse(),
                fileName: "northgate-warehouse-services.pdf",
                fileSizeKb: 920,
                fileHash: hash("b27e"),
            },
        ],
        comments: [
            {
                id: "m3",
                versionNo: 1,
                authorId: "u2",
                type: "APPROVAL",
                text: "All details verified against the signed copy.",
                createdAt: "2026-10-30T12:00:00Z",
            },
        ],
        activity: [
            { at: "2026-10-28T10:00:00Z", byId: "u5", action: "Created draft" },
            { at: "2026-10-29T09:00:00Z", byId: "u5", action: "Submitted version 1" },
            { at: "2026-10-30T12:00:00Z", byId: "u2", action: "Approved version 1" },
        ],
    },
    {
        id: "d3",
        projectId: "p1",
        typeCode: LLA,
        title: "Bandra Office Leave and License",
        status: "DRAFT",
        values: variant(lla(), (v) => {
            for (const key of ["premises_area", "license_fee", "security_deposit"]) delete v.fields[key];
            setCounterparty(v, "Bandra Kurla Estates LLP");
        }),
        draftFileName: "bandra-leave-and-license.pdf",
        draftFileSizeKb: 1310,
        createdById: "u3",
        createdAt: "2026-11-09T16:00:00Z",
        updatedAt: "2026-11-09T16:40:00Z",
        versions: [],
        comments: [],
        activity: [
            { at: "2026-11-09T16:00:00Z", byId: "u3", action: "Created draft" },
            { at: "2026-11-09T16:40:00Z", byId: "u3", action: "Edited details" },
        ],
    },
    {
        id: "d4",
        projectId: "p1",
        typeCode: LLA,
        title: "Powai Retail Leave and License",
        status: "REJECTED",
        instanceId: `${LLA}/2026/0003`,
        values: variant(llaIssues(), (v) => setCounterparty(v, "Powai Retail Ventures")),
        currentVersionNo: 1,
        createdById: "u3",
        createdAt: "2026-11-02T09:00:00Z",
        updatedAt: "2026-11-07T11:20:00Z",
        versions: [
            {
                no: 1,
                submittedBy: "u3",
                submittedAt: "2026-11-05T09:30:00Z",
                values: variant(llaIssues(), (v) => setCounterparty(v, "Powai Retail Ventures")),
                fileName: "powai-retail-leave-and-license.pdf",
                fileSizeKb: 2210,
                fileHash: hash("51d0"),
            },
        ],
        comments: [
            {
                id: "m4",
                versionNo: 1,
                authorId: "u4",
                type: "REJECTION",
                text: "The security deposit is 14 times the monthly fee. Please confirm the amount with the licensor and correct it.",
                createdAt: "2026-11-07T11:20:00Z",
            },
        ],
        activity: [
            { at: "2026-11-02T09:00:00Z", byId: "u3", action: "Created draft" },
            { at: "2026-11-05T09:30:00Z", byId: "u3", action: "Submitted version 1" },
            {
                at: "2026-11-07T11:20:00Z",
                byId: "u4",
                action: "Rejected version 1",
                detail: "Deposit is 14 times the monthly fee",
            },
        ],
    },
    {
        id: "d5",
        projectId: "p1",
        typeCode: LLA,
        title: "Lakeview Office Leave and License 2024",
        status: "INVALID",
        instanceId: `${LLA}/2024/0007`,
        values: variant(lla(), (v) => {
            setCounterparty(v, "Lakeview Estates Ltd");
            setField(v, "execution_date", "2024-05-28");
            setField(v, "effective_date", "2024-06-01");
            setField(v, "term_duration", { value: "3", unit: "years" });
        }),
        currentVersionNo: 1,
        approvedVersionNo: 1,
        attestation: attestation("u2", "2024-05-24T10:00:00Z"),
        createdById: "u5",
        createdAt: "2024-05-20T10:00:00Z",
        updatedAt: "2026-11-01T10:00:00Z",
        invalidatedById: "u2",
        invalidatedAt: "2026-11-01T10:00:00Z",
        invalidationReason: "Replaced by the renegotiated agreement Lakeview 2026.",
        versions: [
            {
                no: 1,
                submittedBy: "u5",
                submittedAt: "2024-05-22T10:00:00Z",
                values: variant(lla(), (v) => {
                    setCounterparty(v, "Lakeview Estates Ltd");
                    setField(v, "execution_date", "2024-05-28");
                    setField(v, "effective_date", "2024-06-01");
                    setField(v, "term_duration", { value: "3", unit: "years" });
                }),
                fileName: "lakeview-lease-2024.pdf",
                fileSizeKb: 1640,
                fileHash: hash("9e02"),
            },
        ],
        comments: [],
        activity: [
            { at: "2024-05-20T10:00:00Z", byId: "u5", action: "Created draft" },
            { at: "2024-05-22T10:00:00Z", byId: "u5", action: "Submitted version 1" },
            { at: "2024-05-24T10:00:00Z", byId: "u2", action: "Approved version 1" },
            {
                at: "2026-11-01T10:00:00Z",
                byId: "u2",
                action: "Marked invalid",
                detail: "Replaced by the renegotiated agreement Lakeview 2026.",
            },
        ],
    },
    {
        id: "d6",
        projectId: "p1",
        typeCode: LLA,
        title: "Lakeview Office Leave and License 2026",
        status: "APPROVAL_PENDING",
        instanceId: `${LLA}/2026/0004`,
        values: variant(lla(), (v) => setCounterparty(v, "Lakeview Estates Ltd")),
        currentVersionNo: 1,
        createdById: "u5",
        createdFromId: "d5",
        createdAt: "2026-11-02T09:00:00Z",
        updatedAt: "2026-11-08T10:00:00Z",
        versions: [
            {
                no: 1,
                submittedBy: "u5",
                submittedAt: "2026-11-08T10:00:00Z",
                values: variant(lla(), (v) => setCounterparty(v, "Lakeview Estates Ltd")),
                fileName: "lakeview-lease-2026.pdf",
                fileSizeKb: 1720,
                fileHash: hash("c7a3"),
            },
        ],
        comments: [],
        activity: [
            {
                at: "2026-11-02T09:00:00Z",
                byId: "u5",
                action: "Created from invalid document",
                detail: `${LLA}/2024/0007`,
            },
            { at: "2026-11-08T10:00:00Z", byId: "u5", action: "Submitted version 1" },
        ],
    },
    {
        id: "d7",
        projectId: "p1",
        typeCode: NDA,
        title: "Vertex Analytics Mutual NDA",
        status: "DRAFT",
        values: sampleValues.ndaDraft(),
        createdById: "u5",
        createdAt: "2026-11-10T08:30:00Z",
        updatedAt: "2026-11-10T08:30:00Z",
        versions: [],
        comments: [],
        activity: [{ at: "2026-11-10T08:30:00Z", byId: "u5", action: "Created draft" }],
    },
    {
        id: "d8",
        projectId: "p1",
        typeCode: NDA,
        title: "Lakeview Analytics Mutual NDA",
        status: "APPROVED",
        instanceId: `${NDA}/2026/0001`,
        values: sampleValues.nda(),
        currentVersionNo: 1,
        approvedVersionNo: 1,
        attestation: attestation("u4", "2026-07-25T10:00:00Z"),
        createdById: "u3",
        createdAt: "2026-07-20T10:00:00Z",
        updatedAt: "2026-07-25T10:00:00Z",
        versions: [
            {
                no: 1,
                submittedBy: "u3",
                submittedAt: "2026-07-22T10:00:00Z",
                values: sampleValues.nda(),
                fileName: "lakeview-analytics-nda.pdf",
                fileSizeKb: 640,
                fileHash: hash("04bb"),
            },
        ],
        comments: [],
        activity: [
            { at: "2026-07-20T10:00:00Z", byId: "u3", action: "Created draft" },
            { at: "2026-07-22T10:00:00Z", byId: "u3", action: "Submitted version 1" },
            { at: "2026-07-25T10:00:00Z", byId: "u4", action: "Approved version 1" },
        ],
    },
    {
        id: "d9",
        projectId: "p2",
        typeCode: WH,
        title: "Urban Furnish Warehousing Agreement",
        status: "APPROVAL_PENDING",
        instanceId: `${WH}/2026/0002`,
        values: variant(sampleValues.warehouse(), (v) => setCounterparty(v, "Urban Furnish Pvt Ltd")),
        currentVersionNo: 1,
        createdById: "u7",
        createdAt: "2026-11-06T10:00:00Z",
        updatedAt: "2026-11-07T10:00:00Z",
        versions: [
            {
                no: 1,
                submittedBy: "u7",
                submittedAt: "2026-11-07T10:00:00Z",
                values: variant(sampleValues.warehouse(), (v) => setCounterparty(v, "Urban Furnish Pvt Ltd")),
                fileName: "urban-furnish-warehousing.pdf",
                fileSizeKb: 780,
                fileHash: hash("6d1f"),
            },
        ],
        comments: [],
        activity: [
            { at: "2026-11-06T10:00:00Z", byId: "u7", action: "Created draft" },
            { at: "2026-11-07T10:00:00Z", byId: "u7", action: "Submitted version 1" },
        ],
    },
];

/** Who the demo signs in as for each role, and which project they open first. */
export const demoPersonas: Record<DemoRole, { userId: string; projectId: string; label: string }> = {
    SUPER_ADMIN: { userId: "u1", projectId: "p2", label: "Super Admin" },
    PROJECT_ADMIN: { userId: "u2", projectId: "p1", label: "Project Admin" },
    MAKER: { userId: "u3", projectId: "p1", label: "Maker" },
    CHECKER: { userId: "u4", projectId: "p1", label: "Checker" },
};
