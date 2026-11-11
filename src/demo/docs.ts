// Small helpers over a document's values that several screens share.
import { composeFields, issuesFor, validateDocument } from "@/templates/engine";
import type {
    DeriveContext,
    DocumentTypeDef,
    DocumentValues,
    FieldDef,
    FieldLibrary,
    Issue,
    PartyValues,
} from "@/templates/model";

import type { ContractDocument } from "./types";

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export const partyDisplayName = (p: PartyValues) => text(p.values.name) || text(p.values.entity) || "—";

/** The other side of the agreement: the first party whose role is not the internal iBUS side. */
export function counterpartyName(values: DocumentValues, type: DocumentTypeDef | undefined): string {
    const externalRole = type?.parties.find((r) => !r.internal)?.role;
    const party =
        values.parties.find((p) => p.role === externalRole) ?? values.parties.find((p) => !/^ibus/i.test(p.role));
    return party ? partyDisplayName(party) : "—";
}

/**
 * The library the Maker fills in: fields collected at approval (such as the Checker's attestation) are taken out,
 * so they never block submission and never appear in the document form.
 */
export function submitLibrary(library: FieldLibrary): FieldLibrary {
    return { ...library, fields: library.fields.filter((f) => f.phase !== "approve") };
}

/** Fields the Checker answers on the approval screen. */
export function approvalFields(library: FieldLibrary, typeCode: string, values: DocumentValues): FieldDef[] {
    return composeFields(library, typeCode, values.custom).filter((f) => f.phase === "approve");
}

export function documentIssues(library: FieldLibrary, typeCode: string, values: DocumentValues): Issue[] {
    const lib = submitLibrary(library);
    const type = lib.documentTypes.find((t) => t.code === typeCode);
    if (!type) return [];
    return validateDocument(lib, composeFields(lib, typeCode, values.custom), type, values);
}

export const nonBlocking = (issues: Issue[]) => issues.filter((i) => i.tier !== "BLOCK");

export function deriveContext(
    doc: Pick<ContractDocument, "instanceId" | "typeCode" | "status" | "attestation">,
    names: { preparedBy?: string; verifiedBy?: string; fileRef?: string },
): DeriveContext {
    return {
        instanceId: doc.instanceId,
        documentTypeCode: doc.typeCode,
        status: doc.status,
        preparedBy: names.preparedBy,
        verifiedBy: doc.attestation ? names.verifiedBy : undefined,
        fileRef: names.fileRef,
    };
}

export { issuesFor };
