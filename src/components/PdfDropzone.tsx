import { FileText, UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_MB = 25;

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
        if (file.size > MAX_MB * 1024 * 1024) {
            setProblem(`The file is larger than ${MAX_MB} MB.`);
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
                <span className="text-xs text-muted-foreground">PDF only · up to {MAX_MB} MB</span>
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
