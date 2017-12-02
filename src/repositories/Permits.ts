import { StreetNumberDescription, applyStreetNumbers } from "./Streets";
import { DB } from "../tables/index";
import { PermitStatus, PermitType } from "../tables/Permit";
import { bulkAssociations, bulkApply } from "../utils/db_utils";

export interface PermitDescriptor {
    id: string
    status?: PermitStatus
    type?: PermitType
    typeWood?: boolean
    statusUpdatedAt?: string
    createdAt?: string
    issuedAt?: string
    completedAt?: string
    expiredAt?: string

    existingStories?: number;
    proposedStories?: number;
    existingUnits?: number;
    proposedUnits?: number;
    existingAffordableUnits?: number;
    proposedAffordableUnits?: number;
    proposedUse?: string;
    description?: string;

    street?: [StreetNumberDescription]
}

function convertDate(src?: string): string | undefined {
    if (src) {
        return src//new Date(src).toUTCString()
    } else {
        return undefined
    }
}

function convertStatus(src?: string): PermitStatus | undefined {
    if (src) {
        return src.toLowerCase() as PermitStatus
    } else {
        return undefined
    }
}

function convertType(src?: string): PermitType | undefined {
    if (src) {
        return src.toLowerCase() as PermitType
    } else {
        return undefined
    }
}

export async function applyPermits(accountId: number, permits: PermitDescriptor[]) {

    //
    // Merging duplicates
    //

    var normalized = new Map<String, PermitDescriptor>()
    for (let p of permits) {
        if (normalized.has(p.id)) {
            normalized.set(p.id, Object.assign(normalized.get(p.id), p))
        } else {
            normalized.set(p.id, p)
        }
    }
    var permits = Array.from(normalized.values())

    //
    // Importing Street Numbers
    //

    console.info("Starting bulk insert/update of permits")
    console.time("street_numbers")
    let streetNumbers = permits
        .filter((p) => p.street)
        .map((p) => p.street!!)
        .reduce((list, x) => list.concat(x), Array<StreetNumberDescription>())
    let loadedNumbers = applyStreetNumbers(accountId, streetNumbers)

    console.timeEnd("street_numbers")

    //
    // Apply Permits
    //

    let rows = permits.map(p => ({
        permitId: p.id,
        permitType: convertType(p.type),
        permitTypeWood: p.typeWood,
        permitStatus: convertStatus(p.status),
        permitCreated: convertDate(p.createdAt),
        permitIssued: convertDate(p.issuedAt),
        permitExpired: convertDate(p.expiredAt),
        permitCompleted: convertDate(p.completedAt),
        permitStatusUpdated: convertDate(p.statusUpdatedAt),
        existingStories: p.existingStories,
        proposedStories: p.proposedStories,
        existingUnits: p.existingUnits,
        proposedUnits: p.proposedUnits,
        existingAffordableUnits: p.existingAffordableUnits,
        proposedAffordableUnits: p.proposedAffordableUnits,
        proposedUse: p.proposedUse,
        description: p.description
    }));

    console.time("bulk_all")
    await DB.tx(async (tx) => {
        let applied = await bulkApply(tx, DB.Permit, accountId, 'permitId', rows)
        var pendingStreets = Array<{ permitId: number, streetId: number }>()

        var index = 0
        var streetIndex = 0
        var pending = await loadedNumbers
        for (let p of permits) {
            if (p.street) {
                for (let _ of p.street) {
                    pendingStreets.push({ permitId: applied[index], streetId: pending[streetIndex]!! })
                    streetIndex++
                }
            }
            index++
        }
        if (pendingStreets.length > 0) {
            let mapped = pendingStreets.map((v) => ({ value1: v.permitId, value2: v.streetId }));
            await bulkAssociations(tx, "permit_street_numbers", "permitId", "streetNumberId", mapped)
        }
    });
    console.timeEnd("bulk_all")
}