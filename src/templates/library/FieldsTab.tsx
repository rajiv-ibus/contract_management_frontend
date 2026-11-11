import { SearchIcon, XIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common";
import { cn } from "@/lib/utils";

import { levelCounts } from "../engine";
import type { FieldDef, FieldLevel, FieldLibrary, Requirement } from "../model";
import { FieldDialog } from "./FieldDialog";
import { LEVEL_META, REQ_META, TYPE_LABEL, appliesToFamily, appliesToList, appliesToType } from "./describe";
import { LevelPill, Mono, ReqBadge } from "./shared";

const PAGE = 50;
const LEVELS: FieldLevel[] = ["L1", "L2", "L3"];
const REQS: Requirement[] = ["M", "O", "D", "C"];

interface Filters {
    level: FieldLevel | "";
    family: string;
    type: string;
    section: string;
    req: Requirement | "";
    q: string;
}

const NO_FILTERS: Filters = { level: "", family: "", type: "", section: "", req: "", q: "" };

export function FieldsTab({ library }: { library: FieldLibrary }) {
    const [filters, setFilters] = useState<Filters>(NO_FILTERS);
    const [limit, setLimit] = useState({ signature: "", count: PAGE });
    const [open, setOpen] = useState<FieldDef | null>(null);

    const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));

    const counts = useMemo(() => levelCounts(library.fields), [library.fields]);
    const sections = useMemo(() => [...new Set(library.fields.map((f) => f.section || "Other"))], [library.fields]);

    const typeChoices = useMemo(
        () => library.documentTypes.filter((t) => !filters.family || t.family === filters.family),
        [library.documentTypes, filters.family],
    );

    const filtered = useMemo(() => {
        const q = filters.q.trim().toLowerCase();
        return library.fields.filter((f) => {
            if (filters.level && f.level !== filters.level) return false;
            if (filters.req && f.req !== filters.req) return false;
            if (filters.section && (f.section || "Other") !== filters.section) return false;
            if (filters.family && !appliesToFamily(library, f, filters.family)) return false;
            if (filters.type && !appliesToType(library, f, filters.type)) return false;
            if (q && !f.label.toLowerCase().includes(q) && !f.key.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [library, filters]);

    // The window goes back to the first page whenever the filters change.
    const signature = JSON.stringify(filters);
    const shown = limit.signature === signature ? limit.count : PAGE;
    const visible = filtered.slice(0, shown);
    const isFiltered = signature !== JSON.stringify(NO_FILTERS);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by level">
                <LevelChip active={filters.level === ""} onClick={() => set("level", "")} count={library.fields.length}>
                    All fields
                </LevelChip>
                {LEVELS.map((level) => (
                    <LevelChip
                        key={level}
                        active={filters.level === level}
                        onClick={() => set("level", filters.level === level ? "" : level)}
                        count={counts[level]}
                        title={LEVEL_META[level].title}
                    >
                        <span className="font-mono">{level}</span> {LEVEL_META[level].name}
                    </LevelChip>
                ))}
            </div>

            <div className="flex flex-wrap items-end gap-3">
                <div className="relative min-w-56 flex-1">
                    <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={filters.q}
                        onChange={(e) => set("q", e.target.value)}
                        placeholder="Search by label or key"
                        aria-label="Search fields by label or key"
                        className="pl-9"
                    />
                </div>
                <FilterSelect
                    label="Family"
                    value={filters.family}
                    onChange={(family) =>
                        setFilters((f) => ({
                            ...f,
                            family,
                            type:
                                f.type &&
                                family &&
                                library.documentTypes.find((t) => t.code === f.type)?.family !== family
                                    ? ""
                                    : f.type,
                        }))
                    }
                    allLabel="All families"
                    options={library.families.map((f) => ({ value: f.code, label: f.name }))}
                />
                <FilterSelect
                    label="Document type"
                    value={filters.type}
                    onChange={(type) => set("type", type)}
                    allLabel="All document types"
                    options={typeChoices.map((t) => ({ value: t.code, label: `${t.code} ${t.name}` }))}
                />
                <FilterSelect
                    label="Section"
                    value={filters.section}
                    onChange={(section) => set("section", section)}
                    allLabel="All sections"
                    options={sections.map((s) => ({ value: s, label: s }))}
                />
                <FilterSelect
                    label="Requirement"
                    value={filters.req}
                    onChange={(req) => set("req", req as Requirement | "")}
                    allLabel="Any requirement"
                    options={REQS.map((r) => ({ value: r, label: `${r} ${REQ_META[r].label}` }))}
                />
                {isFiltered && (
                    <Button variant="ghost" size="sm" onClick={() => setFilters(NO_FILTERS)}>
                        <XIcon />
                        Clear filters
                    </Button>
                )}
            </div>

            <Card className="overflow-hidden">
                {filtered.length === 0 ? (
                    <EmptyState
                        icon={SearchIcon}
                        title="No fields match"
                        text="Change or clear the filters to see more of the field library."
                    />
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead>Field</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Req</TableHead>
                                <TableHead>Level</TableHead>
                                <TableHead>Applies to</TableHead>
                                <TableHead>Section</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visible.map((f) => (
                                <FieldRow key={f.key} library={library} field={f} onOpen={() => setOpen(f)} />
                            ))}
                        </TableBody>
                    </Table>
                )}
                {filtered.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-sm text-muted-foreground">
                        <span>
                            Showing {visible.length} of {filtered.length} field{filtered.length === 1 ? "" : "s"}
                            {isFiltered && ` (library has ${library.fields.length})`}
                        </span>
                        <span className="order-last basis-full text-xs">
                            Req: {REQS.map((r) => `${r} ${REQ_META[r].label.toLowerCase()}`).join(", ")}.
                        </span>
                        {visible.length < filtered.length && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setLimit({ signature, count: shown + PAGE })}
                            >
                                Show {Math.min(PAGE, filtered.length - visible.length)} more
                            </Button>
                        )}
                    </div>
                )}
            </Card>

            <FieldDialog library={library} field={open} onClose={() => setOpen(null)} />
        </div>
    );
}

function LevelChip({
    active,
    count,
    onClick,
    title,
    children,
}: {
    active: boolean;
    count: number;
    onClick: () => void;
    title?: string;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            title={title}
            className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                active
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "bg-card text-foreground hover:bg-muted",
            )}
        >
            <span>{children}</span>
            <span className="rounded-full bg-muted px-1.5 text-xs font-semibold text-muted-foreground tabular-nums">
                {count}
            </span>
        </button>
    );
}

function FilterSelect({
    label,
    value,
    onChange,
    allLabel,
    options,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    allLabel: string;
    options: { value: string; label: string }[];
}) {
    return (
        <div className="w-44 min-w-0">
            <NativeSelect value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} title={label}>
                <option value="">{allLabel}</option>
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </NativeSelect>
        </div>
    );
}

function FieldRow({ library, field, onOpen }: { library: FieldLibrary; field: FieldDef; onOpen: () => void }) {
    const applies = appliesToList(library, field);
    const shown = field.level === "L3" ? applies.slice(0, 2) : applies;
    return (
        <TableRow onClick={onOpen} className="cursor-pointer focus-within:bg-muted/60">
            <TableCell className="max-w-80 min-w-56">
                {/* The button is the keyboard and screen reader way in; its click bubbles to the row's onClick. */}
                <button
                    type="button"
                    aria-haspopup="dialog"
                    title={`Open the details of ${field.label}`}
                    className="block max-w-full truncate rounded-sm text-left font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                >
                    {field.label}
                </button>
                <Mono className="block truncate">{field.key}</Mono>
            </TableCell>
            <TableCell className="whitespace-nowrap">{TYPE_LABEL[field.type]}</TableCell>
            <TableCell>
                <ReqBadge req={field.req} />
            </TableCell>
            <TableCell>
                <LevelPill level={field.level} />
            </TableCell>
            <TableCell className="max-w-64" title={applies.join(", ")}>
                <span className={cn("block truncate", field.level === "L3" && "font-mono text-xs")}>
                    {shown.join(", ")}
                    {shown.length < applies.length && ` +${applies.length - shown.length} more`}
                </span>
            </TableCell>
            <TableCell className="max-w-48">
                <span className="block truncate text-muted-foreground" title={field.section}>
                    {field.section || "Other"}
                </span>
            </TableCell>
        </TableRow>
    );
}
