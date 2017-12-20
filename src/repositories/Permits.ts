import { StreetNumberDescription, applyStreetNumbers } from "./Streets";
import { DB } from "../tables/index";
import { PermitStatus, PermitType } from "../tables/Permit";
import { bulkAssociations, bulkApply } from "../utils/db_utils";
import { PermitEventAttributes } from "../tables/PermitEvents";

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
    expiresAt?: string
    filedAt?: string
    startedAt?: string

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

export async function applyPermits(accountId: number, cityId: number, permits: PermitDescriptor[]) {

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
    let loadedNumbers = await applyStreetNumbers(cityId, streetNumbers)

    console.timeEnd("street_numbers")

    //
    // Apply Permits
    //

    let rows = permits.map(p => ({
        permitId: p.id,
        permitType: convertType(p.type),
        permitTypeWood: p.typeWood,
        permitStatus: convertStatus(p.status),
        permitCreated: p.createdAt,
        permitIssued: p.issuedAt,
        permitExpired: p.expiredAt,
        permitCompleted: p.completedAt,
        permitStarted: p.startedAt,
        permitExpires: p.expiresAt,
        permitFiled: p.filedAt,
        permitStatusUpdated: p.statusUpdatedAt,
        existingStories: p.existingStories,
        proposedStories: p.proposedStories,
        existingUnits: p.existingUnits,
        proposedUnits: p.proposedUnits,
        existingAffordableUnits: p.existingAffordableUnits,
        proposedAffordableUnits: p.proposedAffordableUnits,
        proposedUse: p.proposedUse,
        description: p.description,
    }));

    console.time("bulk_all")

    await DB.tx(async (tx) => {
        let applied = await bulkApply(tx, DB.Permit, accountId, 'permitId', rows)
        var pendingStreets = Array<{ permitId: number, streetId: number }>()
        var pending = loadedNumbers
        var index = 0
        var streetIndex = 0
        for (let p of permits) {
            if (p.street) {
                for (let _ of p.street) {
                    pendingStreets.push({ permitId: applied[index].id, streetId: pending[streetIndex]!! })
                    streetIndex++
                }
            }
            index++
        }
        if (pendingStreets.length > 0) {
            let mapped = pendingStreets.map((v) => ({ value1: v.permitId, value2: v.streetId }));
            await bulkAssociations(tx, "permit_street_numbers", "permitId", "streetNumberId", mapped)
        }

        var pendingEvents = new Array<PermitEventAttributes>()
        for (let p of applied) {
            if (p.changed) {
                let existing = p.oldValue!!;
                let updated = p.newValue!!;
                let changedFields = p.changedFields!!;
                if (changedFields.indexOf('permitStatus') >= 0) {
                    pendingEvents.push({
                        account: accountId,
                        permitId: p.id,
                        eventType: "status_changed",
                        eventContent: {
                            oldStatus: existing.permitStatus,
                            newStatus: updated.permitStatus,
                            time: updated.permitStatusUpdated
                        }
                    });
                    console.warn(updated)
                }
                for (let f of changedFields) {
                    if (f === 'permitStatus') {
                        continue;
                    }
                    pendingEvents.push({
                        account: accountId,
                        permitId: p.id,
                        eventType: "field_changed",
                        eventContent: {
                            field: f,
                            oldValue: (existing as any)[f],
                            newValue: (updated as any)[f],
                        }
                    });
                }
            }
        }
        if (pendingEvents.length > 0) {
            await DB.PermitEvents.bulkCreate(pendingEvents)
        }
    });
    console.timeEnd("bulk_all")
}