import { Download } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { PageHeader, StatusBadge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { counterpartyName } from "@/demo/docs";
import { useDemo, useLookups } from "@/demo/store";
import type { ContractDocument } from "@/demo/types";
import { formatValue } from "@/templates/engine";
import type { DocumentValues, FieldLibrary } from "@/templates/model";

/** Shows a field's value as text, using the library's definition for the type. Empty when the field is not on the document. */
function show(library: FieldLibrary, key: string, values: DocumentValues): string {
    const field = library.fields.find((f) => f.key === key);
    return field ? formatValue(field, values.fields[key]) || "—" : "—";
}

function ReportTable({
    rows,
    valuesOf,
    library,
}: {
    rows: ContractDocument[];
    valuesOf: (d: ContractDocument) => DocumentValues;
    library: FieldLibrary;
}) {
    const { docType } = useLookups();
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Instance ID</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Counterparty</TableHead>
                    <TableHead>Effective date</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Status</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((d) => {
                    const values = valuesOf(d);
                    const type = docType(d.projectId, d.typeCode);
                    return (
                        <TableRow key={d.id}>
                            <TableCell className="font-mono text-xs">{d.instanceId ?? "—"}</TableCell>
                            <TableCell>
                                <Link to={`/documents/${d.id}`} className="font-medium text-primary hover:underline">
                                    {d.title}
                                </Link>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{type?.name}</TableCell>
                            <TableCell>{counterpartyName(values, type)}</TableCell>
                            <TableCell className="whitespace-nowrap">
                                {show(library, "effective_date", values)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                                {show(library, "term_duration", values)}
                            </TableCell>
                            <TableCell>
                                <StatusBadge status={d.status} />
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
}

export function ReportsPage() {
    const { documents, projectId, libraries } = useDemo();
    const library = libraries[projectId];
    const [typeCode, setTypeCode] = useState("");
    const [includeInvalid, setIncludeInvalid] = useState(false);

    const projectDocs = documents.filter((d) => d.projectId === projectId && (!typeCode || d.typeCode === typeCode));
    const approved = projectDocs.filter(
        (d) => d.approvedVersionNo && (d.status === "APPROVED" || (includeInvalid && d.status === "INVALID")),
    );
    const approvedValues = (d: ContractDocument) =>
        d.versions.find((v) => v.no === d.approvedVersionNo)?.values ?? d.values;

    return (
        <>
            <PageHeader
                title="Reports"
                description="Contract details across the project. Approved figures always come from the approved version."
                actions={
                    <Button
                        variant="outline"
                        onClick={() => toast("In the real app this exports the report to Excel.")}
                    >
                        <Download /> Export
                    </Button>
                }
            />
            <div className="mb-4 flex flex-wrap items-end gap-3">
                <div className="w-64">
                    <NativeSelect value={typeCode} onChange={(e) => setTypeCode(e.target.value)}>
                        <option value="">All document types</option>
                        {library.documentTypes.map((t) => (
                            <option key={t.code} value={t.code}>
                                {t.name}
                            </option>
                        ))}
                    </NativeSelect>
                </div>
            </div>
            <Tabs defaultValue="approved">
                <TabsList>
                    <TabsTrigger value="approved">Approved report</TabsTrigger>
                    <TabsTrigger value="working">Working report</TabsTrigger>
                </TabsList>
                <TabsContent value="approved">
                    <label className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                        <input
                            type="checkbox"
                            checked={includeInvalid}
                            onChange={(e) => setIncludeInvalid(e.target.checked)}
                        />
                        Include invalid documents
                    </label>
                    <Card>
                        <ReportTable rows={approved} valuesOf={approvedValues} library={library} />
                    </Card>
                </TabsContent>
                <TabsContent value="working">
                    <p className="mb-3 text-sm text-muted-foreground">
                        Current details of every document, including drafts.
                    </p>
                    <Card>
                        <ReportTable rows={projectDocs} valuesOf={(d) => d.values} library={library} />
                    </Card>
                </TabsContent>
            </Tabs>
        </>
    );
}
