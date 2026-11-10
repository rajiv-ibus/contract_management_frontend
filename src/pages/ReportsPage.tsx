import { Download } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { PageHeader, StatusBadge, fmtDate } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDemo, useLookups } from "@/demo/store";
import type { ContractDocument, Metadata } from "@/demo/types";

const pretty = (v: unknown) =>
    v ? String(v).replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : "—";

function ReportTable({ rows, metadataOf }: { rows: ContractDocument[]; metadataOf: (d: ContractDocument) => Metadata }) {
    const { docType } = useLookups();
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Contract ID</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Counterparty</TableHead>
                    <TableHead>Legal entity</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Pricing</TableHead>
                    <TableHead>Status</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((d) => {
                    const m = metadataOf(d);
                    return (
                        <TableRow key={d.id}>
                            <TableCell className="font-mono text-xs">{String(m.contractIdentifier ?? "—")}</TableCell>
                            <TableCell>
                                <Link to={`/documents/${d.id}`} className="font-medium text-primary hover:underline">
                                    {d.title}
                                </Link>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{docType(d.typeId)?.name}</TableCell>
                            <TableCell>{String(m.counterpartyEntity ?? "—")}</TableCell>
                            <TableCell>{String(m.legalEntity ?? "—")}</TableCell>
                            <TableCell className="whitespace-nowrap">{fmtDate(m.startDate as string | undefined)}</TableCell>
                            <TableCell className="whitespace-nowrap">{fmtDate(m.endDate as string | undefined)}</TableCell>
                            <TableCell>{pretty(m.pricingModel)}</TableCell>
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
    const { documents, projectId, documentTypes } = useDemo();
    const [typeId, setTypeId] = useState("");
    const [includeInvalid, setIncludeInvalid] = useState(false);

    const projectDocs = documents.filter((d) => d.projectId === projectId && (!typeId || d.typeId === typeId));
    const approved = projectDocs.filter((d) => d.approvedVersionNo && (d.status === "APPROVED" || (includeInvalid && d.status === "INVALID")));
    const approvedMetadata = (d: ContractDocument) => d.versions.find((v) => v.no === d.approvedVersionNo)?.metadata ?? d.metadata;

    return (
        <>
            <PageHeader
                title="Reports"
                description="Contract details across the project. Approved figures always come from the approved version."
                actions={
                    <Button variant="outline" onClick={() => toast("In the real app this exports the report to Excel.")}>
                        <Download /> Export
                    </Button>
                }
            />
            <div className="mb-4 flex flex-wrap items-end gap-3">
                <div className="w-60">
                    <NativeSelect value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                        <option value="">All document types</option>
                        {documentTypes
                            .filter((t) => t.projectId === projectId)
                            .map((t) => (
                                <option key={t.id} value={t.id}>
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
                        <input type="checkbox" checked={includeInvalid} onChange={(e) => setIncludeInvalid(e.target.checked)} />
                        Include invalid documents
                    </label>
                    <Card>
                        <ReportTable rows={approved} metadataOf={approvedMetadata} />
                    </Card>
                </TabsContent>
                <TabsContent value="working">
                    <p className="mb-3 text-sm text-muted-foreground">Current details of every document, including drafts.</p>
                    <Card>
                        <ReportTable rows={projectDocs} metadataOf={(d) => d.metadata} />
                    </Card>
                </TabsContent>
            </Tabs>
        </>
    );
}
