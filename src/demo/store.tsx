// In-memory store for the UI prototype. It stands in for the backend API so every screen can be clicked through.
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import * as seed from "./data";
import type {
    Category,
    Comment,
    ContractDocument,
    DemoRole,
    DocumentType,
    FieldDef,
    Membership,
    Metadata,
    NotificationRecipient,
    Project,
    User,
} from "./types";

let counter = 100;
const nextId = (prefix: string) => `${prefix}${++counter}`;
const now = () => new Date().toISOString();
const fakeHash = () => Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

export interface Permissions {
    isSuperAdmin: boolean;
    isAdmin: boolean;
    canMake: boolean;
    canCheck: boolean;
}

export interface DraftInput {
    title: string;
    typeId: string;
    metadata: Metadata;
    fileName?: string;
    fileSizeKb?: number;
}

// The chosen role and project survive a page refresh; sample data changes do not.
const STORAGE_KEY = "cms-demo-view";

function loadView(): { role: DemoRole; projectId: string } {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
        if (saved && saved.role in seed.demoPersonas) return saved;
    } catch {
        // Storage can be unavailable (private window, blocked site data); fall back to the default view.
    }
    return { role: "MAKER", projectId: seed.demoPersonas.MAKER.projectId };
}

function saveView(role: DemoRole, projectId: string) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ role, projectId }));
    } catch {
        // Not critical: the view just resets on refresh.
    }
}

function useDemoState() {
    const [initialView] = useState(loadView);
    const [role, setRoleState] = useState<DemoRole>(initialView.role);
    const [projectId, setProjectIdState] = useState(initialView.projectId);
    const [users, setUsers] = useState<User[]>(seed.users);
    const [projects, setProjects] = useState<Project[]>(seed.projects);
    const [memberships, setMemberships] = useState<Membership[]>(seed.memberships);
    const [categories, setCategories] = useState<Category[]>(seed.categories);
    const [documentTypes, setDocumentTypes] = useState<DocumentType[]>(seed.documentTypes);
    const [recipients, setRecipients] = useState<NotificationRecipient[]>(seed.notificationRecipients);
    const [documents, setDocuments] = useState<ContractDocument[]>(seed.documents);

    const currentUserId = seed.demoPersonas[role].userId;
    const currentUser = users.find((u) => u.id === currentUserId)!;
    const membership = memberships.find((m) => m.userId === currentUserId && m.projectId === projectId);

    const permissions: Permissions = {
        isSuperAdmin: currentUser.isSuperAdmin,
        isAdmin: !!membership?.isAdmin,
        canMake: !!membership?.canMake,
        canCheck: !!membership?.canCheck,
    };

    const myProjects = projects.filter((p) => memberships.some((m) => m.userId === currentUserId && m.projectId === p.id));

    function setRole(next: DemoRole) {
        const nextProject = seed.demoPersonas[next].projectId;
        setRoleState(next);
        setProjectIdState(nextProject);
        saveView(next, nextProject);
    }

    function setProjectId(next: string) {
        setProjectIdState(next);
        saveView(role, next);
    }

    function updateDoc(id: string, change: (d: ContractDocument) => ContractDocument) {
        setDocuments((all) => all.map((d) => (d.id === id ? change(d) : d)));
    }

    const log = (action: string, detail?: string) => ({ at: now(), byId: currentUserId, action, detail });

    const actions = {
        saveDraft(id: string | null, input: DraftInput): string {
            if (id) {
                updateDoc(id, (d) => ({
                    ...d,
                    title: input.title,
                    typeId: input.typeId,
                    metadata: input.metadata,
                    draftFileName: input.fileName ?? d.draftFileName,
                    draftFileSizeKb: input.fileSizeKb ?? d.draftFileSizeKb,
                    updatedAt: now(),
                    activity: [...d.activity, log("Edited details")],
                }));
                return id;
            }
            const newId = nextId("d");
            setDocuments((all) => [
                {
                    id: newId,
                    projectId,
                    typeId: input.typeId,
                    title: input.title,
                    status: "DRAFT",
                    metadata: input.metadata,
                    draftFileName: input.fileName,
                    draftFileSizeKb: input.fileSizeKb,
                    createdById: currentUserId,
                    createdAt: now(),
                    updatedAt: now(),
                    versions: [],
                    comments: [],
                    activity: [log("Created draft")],
                },
                ...all,
            ]);
            return newId;
        },

        submit(id: string) {
            updateDoc(id, (d) => {
                const no = d.versions.length + 1;
                return {
                    ...d,
                    status: "APPROVAL_PENDING",
                    currentVersionNo: no,
                    restoredFromVersionNo: undefined,
                    updatedAt: now(),
                    versions: [
                        ...d.versions,
                        {
                            no,
                            submittedBy: currentUserId,
                            submittedAt: now(),
                            metadata: d.metadata,
                            fileName: d.draftFileName ?? "contract.pdf",
                            fileSizeKb: d.draftFileSizeKb ?? 1000,
                            fileHash: fakeHash(),
                            restoredFrom: d.restoredFromVersionNo,
                        },
                    ],
                    activity: [...d.activity, log(`Submitted version ${no}`)],
                };
            });
        },

        approve(id: string, text: string) {
            updateDoc(id, (d) => ({
                ...d,
                status: "APPROVED",
                approvedVersionNo: d.currentVersionNo,
                updatedAt: now(),
                comments: text.trim()
                    ? [...d.comments, decisionComment(d, "APPROVAL", text, currentUserId)]
                    : d.comments,
                activity: [...d.activity, log(`Approved version ${d.currentVersionNo}`, text.trim() || undefined)],
            }));
        },

        reject(id: string, text: string) {
            updateDoc(id, (d) => ({
                ...d,
                status: "REJECTED",
                updatedAt: now(),
                comments: [...d.comments, decisionComment(d, "REJECTION", text, currentUserId)],
                activity: [...d.activity, log(`Rejected version ${d.currentVersionNo}`, text)],
            }));
        },

        reopen(id: string) {
            updateDoc(id, (d) => ({
                ...d,
                status: "DRAFT",
                updatedAt: now(),
                activity: [...d.activity, log("Reopened for correction")],
            }));
        },

        invalidate(id: string, reason: string) {
            updateDoc(id, (d) => ({
                ...d,
                status: "INVALID",
                invalidatedById: currentUserId,
                invalidatedAt: now(),
                invalidationReason: reason,
                updatedAt: now(),
                activity: [...d.activity, log("Marked invalid", reason)],
            }));
        },

        deleteDraft(id: string) {
            setDocuments((all) => all.filter((d) => d.id !== id));
        },

        createFromInvalid(id: string): string {
            const source = documents.find((d) => d.id === id)!;
            const approved = source.versions.find((v) => v.no === source.approvedVersionNo);
            const newId = nextId("d");
            setDocuments((all) => [
                {
                    id: newId,
                    projectId: source.projectId,
                    typeId: source.typeId,
                    title: `${source.title} (new)`,
                    status: "DRAFT",
                    metadata: { ...(approved?.metadata ?? source.metadata) },
                    draftFileName: approved?.fileName,
                    draftFileSizeKb: approved?.fileSizeKb,
                    createdById: currentUserId,
                    createdFromId: source.id,
                    createdAt: now(),
                    updatedAt: now(),
                    versions: [],
                    comments: [],
                    activity: [log("Created from invalid document", String(source.metadata.contractIdentifier ?? ""))],
                },
                ...all,
            ]);
            return newId;
        },

        restoreVersion(id: string, versionNo: number) {
            updateDoc(id, (d) => {
                const v = d.versions.find((x) => x.no === versionNo)!;
                return {
                    ...d,
                    metadata: { ...v.metadata },
                    draftFileName: v.fileName,
                    draftFileSizeKb: v.fileSizeKb,
                    updatedAt: now(),
                    restoredFromVersionNo: versionNo,
                    activity: [...d.activity, log(`Restored version ${versionNo} to draft`)],
                };
            });
        },

        addComment(id: string, versionNo: number, text: string, replyToId?: string) {
            updateDoc(id, (d) => ({
                ...d,
                comments: [
                    ...d.comments,
                    { id: nextId("m"), versionNo, authorId: currentUserId, type: "COMMENT", text, createdAt: now(), replyToId },
                ],
            }));
        },

        inviteUser(name: string, email: string): string {
            const id = nextId("u");
            setUsers((all) => [...all, { id, name, email, status: "INVITED", isSuperAdmin: false }]);
            return id;
        },

        setUserStatus(userId: string, status: User["status"]) {
            setUsers((all) => all.map((u) => (u.id === userId ? { ...u, status } : u)));
        },

        setUserMemberships(userId: string, next: Membership[]) {
            setMemberships((all) => [...all.filter((m) => m.userId !== userId), ...next]);
        },

        setMemberRoles(project: string, userId: string, canMake: boolean, canCheck: boolean) {
            setMemberships((all) =>
                all.map((m) => (m.projectId === project && m.userId === userId ? { ...m, canMake, canCheck } : m)),
            );
        },

        addProject(code: string, name: string, description: string) {
            setProjects((all) => [...all, { id: nextId("p"), code, name, description, active: true }]);
        },

        updateProject(id: string, change: Partial<Project>) {
            setProjects((all) => all.map((p) => (p.id === id ? { ...p, ...change } : p)));
        },

        addCategory(code: string, name: string) {
            setCategories((all) => [...all, { id: nextId("c"), projectId, code, name }]);
        },

        addDocumentType(categoryId: string, code: string, name: string, fields: FieldDef[]) {
            setDocumentTypes((all) => [
                ...all,
                {
                    id: nextId("t"),
                    projectId,
                    categoryId,
                    code,
                    name,
                    activeTemplateNo: 1,
                    templates: [{ no: 1, createdAt: now(), createdBy: currentUserId, fields }],
                },
            ]);
        },

        addTemplateVersion(typeId: string, fields: FieldDef[]) {
            setDocumentTypes((all) =>
                all.map((t) => {
                    if (t.id !== typeId) return t;
                    const no = t.templates.length + 1;
                    return {
                        ...t,
                        activeTemplateNo: no,
                        templates: [...t.templates, { no, createdAt: now(), createdBy: currentUserId, fields }],
                    };
                }),
            );
        },

        addRecipient(email: string, name?: string) {
            setRecipients((all) => [...all, { id: nextId("r"), projectId, email, name }]);
        },

        removeRecipient(id: string) {
            setRecipients((all) => all.filter((r) => r.id !== id));
        },
    };

    return {
        role,
        setRole,
        projectId,
        setProjectId,
        currentUser,
        permissions,
        myProjects,
        users,
        projects,
        memberships,
        categories,
        documentTypes,
        recipients,
        documents,
        actions,
    };
}

function decisionComment(
    d: ContractDocument,
    type: Comment["type"],
    text: string,
    authorId: string,
): Comment {
    return { id: nextId("m"), versionNo: d.currentVersionNo!, authorId, type, text, createdAt: now() };
}

type DemoStore = ReturnType<typeof useDemoState>;

const DemoContext = createContext<DemoStore | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
    const store = useDemoState();
    return <DemoContext.Provider value={store}>{children}</DemoContext.Provider>;
}

export function useDemo() {
    const store = useContext(DemoContext);
    if (!store) throw new Error("useDemo must be used inside DemoProvider");
    return store;
}

/** Lookups that most screens need. */
export function useLookups() {
    const { users, documentTypes, categories, projects } = useDemo();
    return useMemo(
        () => ({
            userName: (id?: string) => users.find((u) => u.id === id)?.name ?? "—",
            docType: (id: string) => documentTypes.find((t) => t.id === id),
            categoryName: (id: string) => categories.find((c) => c.id === id)?.name ?? "—",
            projectName: (id: string) => projects.find((p) => p.id === id)?.name ?? "—",
        }),
        [users, documentTypes, categories, projects],
    );
}
