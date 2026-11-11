import { format, formatDistanceToNow, parseISO } from "date-fns";
import { CheckCircle2, Clock, FileEdit, Ban, XCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import type { WorkflowStatus } from "@/demo/types";
import { cn } from "@/lib/utils";

export const statusMeta: Record<
    WorkflowStatus,
    { label: string; variant: "draft" | "pending" | "rejected" | "approved" | "invalid"; icon: LucideIcon }
> = {
    DRAFT: { label: "Draft", variant: "draft", icon: FileEdit },
    APPROVAL_PENDING: { label: "Approval pending", variant: "pending", icon: Clock },
    REJECTED: { label: "Rejected", variant: "rejected", icon: XCircle },
    APPROVED: { label: "Approved", variant: "approved", icon: CheckCircle2 },
    INVALID: { label: "Invalid", variant: "invalid", icon: Ban },
};

export function StatusBadge({ status, className }: { status: WorkflowStatus; className?: string }) {
    const meta = statusMeta[status];
    const Icon = meta.icon;
    return (
        <Badge variant={meta.variant} className={className}>
            <Icon />
            {meta.label}
        </Badge>
    );
}

export function PageHeader({
    title,
    description,
    actions,
    children,
}: {
    title: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    children?: ReactNode;
}) {
    return (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
                {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
                {children}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
    );
}

export function EmptyState({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text?: string }) {
    return (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
            <div className="rounded-full bg-muted p-3">
                <Icon className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">{title}</p>
            {text && <p className="max-w-sm text-sm text-muted-foreground">{text}</p>}
        </div>
    );
}

export function Initials({ name, className }: { name: string; className?: string }) {
    const initials = name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
    return (
        <span
            className={cn(
                "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary",
                className,
            )}
        >
            {initials}
        </span>
    );
}

/** Dates are stored in UTC and shown in IST. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const toIst = (iso: string) =>
    new Date(parseISO(iso).getTime() + IST_OFFSET_MS + new Date().getTimezoneOffset() * 60000);

export const fmtDate = (iso?: string) =>
    iso ? format(iso.length === 10 ? parseISO(iso) : toIst(iso), "dd MMM yyyy") : "—";
export const fmtDateTime = (iso?: string) => (iso ? `${format(toIst(iso), "dd MMM yyyy, h:mm a")} IST` : "—");
export const fmtAgo = (iso?: string) => {
    if (!iso) return "—";
    const date = parseISO(iso);
    return date.getTime() > Date.now() ? "just now" : formatDistanceToNow(date, { addSuffix: true });
};

export function DemoNote({ children }: { children: ReactNode }) {
    return (
        <p className="rounded-md border border-dashed border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
            {children}
        </p>
    );
}
