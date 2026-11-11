import { CheckCircle2Icon, DownloadIcon, SaveIcon, ShieldCheckIcon, UploadIcon, XCircleIcon } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";

import type { FieldLibrary } from "../model";
import { checkLibraryText } from "./check";
import { sameLibraryContent } from "./describe";
import { downloadText, fileSlug } from "./shared";

interface CheckResult {
    /** The exact text that was checked. Editing the text afterwards makes the result stale. */
    text: string;
    library?: FieldLibrary;
    errors: string[];
    warnings: string[];
}

interface JsonTabProps {
    library: FieldLibrary;
    projectName: string;
    text: string;
    onTextChange: (next: string) => void;
    onSave: (next: FieldLibrary) => void;
}

export function JsonTab({ library, projectName, text, onTextChange, onSave }: JsonTabProps) {
    const [result, setResult] = useState<CheckResult | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);

    const fresh = result !== null && result.text === text;
    const passed = fresh && !!result.library && result.errors.length === 0;
    const differs = passed && !sameLibraryContent(result.library!, library);
    const nextVersion = library.version + 1;

    const check = () => setResult({ text, ...checkLibraryText(text) });

    const upload = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        try {
            onTextChange(await file.text());
            setResult(null);
            toast.success(`Loaded ${file.name}. Check it before saving.`);
        } catch {
            toast.error(`Could not read ${file.name}`);
        }
    };

    const save = () => {
        if (!passed || !result.library) return;
        onSave({ ...result.library, version: nextVersion });
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
                <p>
                    <span className="font-medium">Current version: {library.version}.</span> Edit the library below, run
                    the check, then save it as version {nextVersion}.
                </p>
                <p className="mt-1 text-muted-foreground">
                    Saved versions are frozen. Documents already submitted keep the version they were submitted with.
                </p>
            </div>

            <Textarea
                value={text}
                onChange={(e) => onTextChange(e.target.value)}
                spellCheck={false}
                wrap="off"
                aria-label="Field library JSON"
                className="h-[28rem] resize-y overflow-auto font-mono text-xs leading-relaxed whitespace-pre"
            />

            <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={check}>
                    <ShieldCheckIcon />
                    Check
                </Button>
                <Button variant="outline" onClick={() => fileInput.current?.click()}>
                    <UploadIcon />
                    Upload .json
                </Button>
                <input
                    ref={fileInput}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={upload}
                    aria-label="Upload a library JSON file"
                />
                <Button
                    variant="outline"
                    onClick={() => downloadText(`${fileSlug(projectName)}-field-library-edit.json`, text)}
                >
                    <DownloadIcon />
                    Download .json
                </Button>
                <Button className="sm:ml-auto" onClick={save} disabled={!differs}>
                    <SaveIcon />
                    Save as version {nextVersion}
                </Button>
            </div>
            {passed && !differs && (
                <p className="text-xs text-muted-foreground">
                    The JSON has the same content as version {library.version}, so there is nothing to save.
                </p>
            )}
            {result && !fresh && (
                <p className="text-xs text-muted-foreground">The text changed since the last check. Check it again.</p>
            )}

            {/* The live region stays mounted so a screen reader announces each new result. */}
            <div aria-live="polite" role="status">
                {result && <CheckSummary result={result} stale={!fresh} />}
            </div>
        </div>
    );
}

function CheckSummary({ result, stale }: { result: CheckResult; stale: boolean }) {
    const { library, errors, warnings } = result;
    return (
        <div className={stale ? "flex flex-col gap-3 opacity-60" : "flex flex-col gap-3"}>
            {errors.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    <p className="mb-1.5 flex items-center gap-1.5 font-medium">
                        <XCircleIcon className="size-4" />
                        {errors.length} error{errors.length === 1 ? "" : "s"}: fix these before saving
                    </p>
                    <ul className="max-h-56 list-disc space-y-0.5 overflow-y-auto pl-5">
                        {errors.map((e, i) => (
                            <li key={i}>{e}</li>
                        ))}
                    </ul>
                </div>
            )}
            {warnings.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    <p className="mb-1.5 font-medium">
                        {warnings.length} warning{warnings.length === 1 ? "" : "s"}: these do not stop you saving
                    </p>
                    <ul className="max-h-56 list-disc space-y-0.5 overflow-y-auto pl-5">
                        {warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                        ))}
                    </ul>
                </div>
            )}
            {library && errors.length === 0 && (
                <p className="flex items-center gap-1.5 rounded-lg border border-status-approved/30 bg-status-approved/10 px-4 py-3 text-sm font-medium text-status-approved">
                    <CheckCircle2Icon className="size-4" />
                    {library.fields.length} fields, {library.documentTypes.length} document types,{" "}
                    {library.rules.length} rules
                </p>
            )}
        </div>
    );
}
