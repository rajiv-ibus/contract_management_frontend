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

export interface Category {
    id: string;
    projectId: string;
    code: string;
    name: string;
}

export type FieldType = "string" | "text" | "date" | "enum" | "decimal" | "tags";

export interface FieldDef {
    key: string;
    label: string;
    type: FieldType;
    required: boolean;
    options?: string[];
    showWhen?: Record<string, string>;
    hint?: string;
}

export interface TemplateVersion {
    no: number;
    createdAt: string;
    createdBy: string;
    fields: FieldDef[];
}

export interface DocumentType {
    id: string;
    projectId: string;
    categoryId: string;
    code: string;
    name: string;
    activeTemplateNo: number;
    templates: TemplateVersion[];
}

export type Metadata = Record<string, string | string[]>;

export interface Version {
    no: number;
    submittedBy: string;
    submittedAt: string;
    metadata: Metadata;
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

export interface ContractDocument {
    id: string;
    projectId: string;
    typeId: string;
    title: string;
    status: WorkflowStatus;
    metadata: Metadata;
    draftFileName?: string;
    draftFileSizeKb?: number;
    currentVersionNo?: number;
    approvedVersionNo?: number;
    createdById: string;
    createdAt: string;
    updatedAt: string;
    createdFromId?: string;
    restoredFromVersionNo?: number;
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
