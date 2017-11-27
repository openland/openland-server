import { StreetNumberDescription, applyStreetNumbers } from "./Streets";
import { DB } from "../tables/index";
import { PermitAttributes, Permit, PermitStatus, PermitType } from "../tables/Permit";

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

function convertDate(src?: string): Date | undefined {
    if (src) {
        return new Date(src)
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
    let loadedNumbers = (await applyStreetNumbers(accountId, streetNumbers)).map((p) => p.id!!)
    var streetIndex = 0
    console.timeEnd("street_numbers")

    //
    // Apply Permits
    //

    console.time("bulk_all")
    await DB.tx(async (tx) => {
        console.time("load_all")
        let existing = await DB.Permit.findAll({
            where: {
                account: accountId,
                permitId: permits.map(p => p.id)
            },
            include: [{
                model: DB.StreetNumber,
                as: 'streetNumbers'
            }]
        })
        console.timeEnd("load_all")

        console.time("prepare")
        var pending = Array<PermitAttributes>()
        var waits = Array<PromiseLike<Permit>>()
        var pendingStreets = Array<{ permitId: number, streetId: number }>()
        var pendingStreetsIndex = Array<{ permitIndex: number, streetId: number }>()

        var map: { [key: string]: Permit } = {}
        for (let p of existing) {
            map[p.permitId!!] = p
        }
        var index = 0
        for (let p of permits) {
            let ex = map[p.id]
            if (ex) {
                if (p.createdAt) {
                    ex.permitCreated = convertDate(p.createdAt)
                }
                if (p.expiredAt) {
                    ex.permitExpired = convertDate(p.createdAt)
                }
                if (p.issuedAt) {
                    ex.permitIssued = convertDate(p.issuedAt)
                }
                if (p.completedAt) {
                    ex.permitCompleted = convertDate(p.completedAt)
                }
                if (p.status) {
                    ex.permitStatus = convertStatus(p.status)
                }
                if (p.statusUpdatedAt) {
                    ex.permitStatusUpdated = convertDate(p.statusUpdatedAt)
                }

                if (p.type) {
                    ex.permitType = convertType(p.type)
                }
                if (p.typeWood) {
                    ex.permitTypeWood = p.typeWood
                }

                if (p.existingStories) {
                    ex.existingStories = p.existingStories
                }
                if (p.proposedStories) {
                    ex.proposedStories = p.proposedStories
                }
                if (p.existingUnits) {
                    ex.existingUnits = p.existingUnits
                }
                if (p.proposedUnits) {
                    ex.proposedUnits = p.proposedUnits
                }
                if (p.existingAffordableUnits) {
                    ex.existingAffordableUnits = p.existingAffordableUnits
                }
                if (p.proposedAffordableUnits) {
                    ex.proposedAffordableUnits = p.proposedAffordableUnits
                }
                if (p.proposedUse) {
                    ex.proposedUse = p.proposedUse
                }
                if (p.description) {
                    ex.description = p.description
                }

                waits.push(ex.save())

                //
                // Create Street
                //
                if (p.street) {
                    for (let _ of p.street) {
                        if (!ex.streetNumbers!!.find((p, v) => p.id == loadedNumbers[streetIndex])) {
                            pendingStreets.push({ permitId: ex.id!!, streetId: loadedNumbers[streetIndex]!! })
                        }
                        streetIndex++
                    }
                }
            } else {
                pending.push({
                    account: accountId,
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
                })
                if (p.street) {
                    for (let _ of p.street) {
                        pendingStreetsIndex.push({ permitIndex: index, streetId: loadedNumbers[streetIndex]!! })
                        streetIndex++
                    }
                }
                index++
            }
        }
        console.timeEnd("prepare")

        if (pending.length > 0) {
            console.time("insert")
            let bulked = await DB.Permit.bulkCreate(pending, { returning: true })
            for (let s of pendingStreetsIndex) {
                pendingStreets.push({ permitId: bulked[s.permitIndex].id!!, streetId: s.streetId })
            }
            console.timeEnd("insert")
        }


        if (waits.length > 0) {
            console.time("waiting")
            for (let p of waits) {
                await p
            }
            console.timeEnd("waiting")
        }

        if (pendingStreets.length > 0) {
            console.time("street_associations")
            let mapped = pendingStreets.map((v) => ({ value1: v.permitId, value2: v.streetId }));
            await DB.bulkAssociations("permit_street_numbers", "permitId", "streetNumberId", mapped)
            console.timeEnd("street_associations")
        }
    });
    console.timeEnd("bulk_all")
}