import { FileText, UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";

import { fmtDate } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/form";
import type { FieldDef, Metadata } from "@/demo/types";
import { cn } from "@/lib/utils";

export const isVisible = (f: FieldDef, values: Metadata) =>
    !f.showWhen || Object.entries(f.showWhen).every(([k, v]) => values[k] === v);

export function missingRequired(fields: FieldDef[], values: Metadata) {
    return fields
        .filter((f) => f.required && isVisible(f, values))
        .filter((f) => {
            const v = values[f.key];
            return Array.isArray(v) ? v.length === 0 : !String(v ?? "").trim();
        })
        .map((f) => f.key);
}

export function fieldErrors(fields: FieldDef[], values: Metadata) {
    const errors: Record<string, string> = {};
    for (const key of missingRequired(fields, values)) errors[key] = "Required";
    const start = String(values.startDate ?? "");
    const end = String(values.endDate ?? "");
    if (start && end && end < start) errors.endDate = "End date must be on or after the start date";
    for (const f of fields.filter((x) => x.type === "decimal" && isVisible(x, values))) {
        const v = String(values[f.key] ?? "");
        if (v && !/^\d+(\.\d{1,2})?$/.test(v)) errors[f.key] = "Enter a number, up to 2 decimals";
    }
    return errors;
}

// Turns option codes like REVENUE_SHARE into "Revenue share"; readable options are shown as they are.
const prettify = (v: string) =>
    /^[A-Z0-9_]+$/.test(v) ? v.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : v;

export function MetadataForm({
    fields,
    values,
    onChange,
    errors,
}: {
    fields: FieldDef[];
    values: Metadata;
    onChange: (next: Metadata) => void;
    errors: Record<string, string>;
}) {
    const set = (key: string, value: string | string[]) => onChange({ ...values, [key]: value });

    return (
        <div className="grid gap-4 sm:grid-cols-2">
            {fields
                .filter((f) => isVisible(f, values))
                .map((f) => {
                    const value = values[f.key];
                    const id = `f-${f.key}`;
                    const invalid = !!errors[f.key];
                    let control;
                    if (f.type === "enum") {
                        control = (
                            <NativeSelect id={id} aria-invalid={invalid} value={String(value ?? "")} onChange={(e) => set(f.key, e.target.value)}>
                                <option value="">Select…</option>
                                {f.options?.map((o) => (
                                    <option key={o} value={o}>
                                        {prettify(o)}
                                    </option>
                                ))}
                            </NativeSelect>
                        );
                    } else if (f.type === "text") {
                        control = <Textarea id={id} aria-invalid={invalid} value={String(value ?? "")} onChange={(e) => set(f.key, e.target.value)} />;
                    } else if (f.type === "tags") {
                        control = (
                            <Input
                                id={id}
                                value={Array.isArray(value) ? value.join(", ") : String(value ?? "")}
                                onChange={(e) =>
                                    set(
                                        f.key,
                                        e.target.value.split(",").map((s) => s.trimStart()),
                                    )
                                }
                            />
                        );
                    } else {
                        control = (
                            <Input
                                id={id}
                                aria-invalid={invalid}
                                type={f.type === "date" ? "date" : "text"}
                                inputMode={f.type === "decimal" ? "decimal" : undefined}
                                value={String(value ?? "")}
                                onChange={(e) => set(f.key, e.target.value)}
                            />
                        );
                    }
                    return (
                        <Field
                            key={f.key}
                            label={f.label}
                            required={f.required}
                            htmlFor={id}
                            hint={errors[f.key] ? undefined : f.hint}
                            className={cn(f.type === "text" && "sm:col-span-2")}
                        >
                            {control}
                            {errors[f.key] && <p className="text-xs text-destructive">{errors[f.key]}</p>}
                        </Field>
                    );
                })}
        </div>
    );
}

export function displayValue(f: FieldDef, value: Metadata[string]) {
    if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) return "—";
    if (Array.isArray(value)) return value.filter(Boolean).join(", ");
    if (f.type === "date") return fmtDate(value);
    if (f.type === "enum") return prettify(value);
    if (f.key === "fixedAmount") return `₹ ${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    if (f.key === "revenueSharePercent") return `${value} %`;
    return value;
}

export function MetadataView({
    fields,
    values,
    compareTo,
}: {
    fields: FieldDef[];
    values: Metadata;
    compareTo?: Metadata;
}) {
    return (
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {fields
                .filter((f) => isVisible(f, values))
                .map((f) => {
                    const changed =
                        compareTo && JSON.stringify(compareTo[f.key] ?? "") !== JSON.stringify(values[f.key] ?? "");
                    return (
                        <div key={f.key} className={cn(f.type === "text" && "sm:col-span-2")}>
                            <dt className="text-xs font-medium text-muted-foreground">{f.label}</dt>
                            <dd className={cn("mt-0.5 text-sm", changed && "rounded bg-amber-100 px-1 -mx-1 w-fit")}>
                                {displayValue(f, values[f.key])}
                                {changed && <span className="ml-2 text-[11px] text-amber-800">changed</span>}
                            </dd>
                        </div>
                    );
                })}
        </dl>
    );
}

export function PdfDropzone({
    fileName,
    fileSizeKb,
    onFile,
    onClear,
    error,
}: {
    fileName?: string;
    fileSizeKb?: number;
    onFile: (name: string, sizeKb: number) => void;
    onClear: () => void;
    error?: string;
}) {
    const input = useRef<HTMLInputElement>(null);
    const [problem, setProblem] = useState("");
    const [dragging, setDragging] = useState(false);

    function accept(file?: File) {
        if (!file) return;
        if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
            setProblem("Only PDF files can be uploaded.");
            return;
        }
        if (file.size > 25 * 1024 * 1024) {
            setProblem("The file is larger than 25 MB.");
            return;
        }
        setProblem("");
        onFile(file.name, Math.round(file.size / 1024));
    }

    if (fileName) {
        return (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
                <div className="rounded-md bg-red-50 p-2">
                    <FileText className="size-5 text-red-600" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{fileName}</p>
                    <p className="text-xs text-muted-foreground">
                        PDF · {fileSizeKb ? `${(fileSizeKb / 1024).toFixed(1)} MB` : ""}
                    </p>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Remove file">
                    <X />
                </Button>
            </div>
        );
    }

    return (
        <div>
            <button
                type="button"
                onClick={() => input.current?.click()}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    accept(e.dataTransfer.files[0]);
                }}
                className={cn(
                    "flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors",
                    dragging ? "border-primary bg-primary/5" : "border-input hover:bg-muted/50",
                    (error || problem) && "border-destructive/60",
                )}
            >
                <UploadCloud className="size-7 text-muted-foreground" />
                <span className="text-sm font-medium">Drop the contract PDF here, or click to choose</span>
                <span className="text-xs text-muted-foreground">PDF only · up to 25 MB</span>
            </button>
            <input
                ref={input}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => accept(e.target.files?.[0])}
            />
            {(problem || error) && <p className="mt-1.5 text-xs text-destructive">{problem || error}</p>}
        </div>
    );
}
