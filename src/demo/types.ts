import type { DocumentValues } from "@/templates/model";

export type WorkflowStatus = "DRAFT" | "APPROVAL_PENDING" | "REJECTED" | "APPROVED" | "INVALID";
export type UserStatus = "INVITED" | "ACTIVE" | "DEACTIVATED";
export type CommentType = "COMMENT" | "APPROVAL" | "REJECTION";

export interface User {
    id: string;
    name: string;
    email: string;
    status: UserStatus;
    isSuperAdmin: boolean;
    lastLoginAt?: string;
}

export interface Project {
    id: string;
    code: string;
    name: string;
    description: string;
    active: boolean;
}

export interface Membership {
    userId: string;
    projectId: string;
    isAdmin: boolean;
    canMake: boolean;
    canCheck: boolean;
}

export interface Version {
    no: number;
    submittedBy: string;
    submittedAt: string;
    /** Frozen at submission. Parties, field values and the one-off (L4) fields all travel together. */
    values: DocumentValues;
    fileName: string;
    fileSizeKb: number;
    fileHash: string;
    restoredFrom?: number;
}

export interface Comment {
    id: string;
    versionNo: number;
    authorId: string;
    type: CommentType;
    text: string;
    createdAt: string;
    replyToId?: string;
}

export interface Activity {
    at: string;
    byId: string;
    action: string;
    detail?: string;
}

/** The Checker's attestation, recorded when a version is approved. */
export interface Attestation {
    byId: string;
    at: string;
    items: string[];
}

export interface ContractDocument {
    id: string;
    projectId: string;
    /** Register ID of the document type, e.g. IBUS-PRP-LLA-OUT. */
    typeCode: string;
    title: string;
    status: WorkflowStatus;
    /** Working copy. Editable only while the document is a draft. */
    values: DocumentValues;
    /** Assigned on first submission and never reissued: <type>/<year>/<number>. */
    instanceId?: string;
    draftFileName?: string;
    draftFileSizeKb?: number;
    currentVersionNo?: number;
    approvedVersionNo?: number;
    attestation?: Attestation;
    restoredFromVersionNo?: number;
    createdById: string;
    createdAt: string;
    updatedAt: string;
    createdFromId?: string;
    invalidatedById?: string;
    invalidatedAt?: string;
    invalidationReason?: string;
    versions: Version[];
    comments: Comment[];
    activity: Activity[];
}

export interface NotificationRecipient {
    id: string;
    projectId: string;
    email: string;
    name?: string;
}

/** The role the demo is viewed as. Real access always comes from the user's project memberships. */
export type DemoRole = "SUPER_ADMIN" | "PROJECT_ADMIN" | "MAKER" | "CHECKER";
