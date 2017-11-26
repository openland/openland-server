import { StreetNumberDescription, applyStreetNumbers } from "./Streets";
import { DB } from "../tables/index";
import { PermitAttributes, Permit, PermitStatus } from "../tables/Permit";

export interface PermitDescriptor {
    id: string
    status?: PermitStatus
    createdAt?: string
    issuedAt?: string
    completedAt?: string
    expiredAt?: string
    street?: [StreetNumberDescription]
}

function convertDate(src?: string): Date | undefined {
    if (src) {
        return new Date(src)
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

        var map: { [key: string]: Permit } = {}
        for (let p of existing) {
            map[p.permitId!!] = p
        }
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
                    ex.permitStatus = p.status
                }
                waits.push(ex.save())

                //
                // Create Street
                //
                if (p.street) {
                    for (let _ of p.street) {
                        if (!ex.streetNumbers!!.find((p, v) => p.id == loadedNumbers[streetIndex])) {
                            await ex.addStreetNumber!!(loadedNumbers[streetIndex])
                        }
                        streetIndex++
                    }
                }
            } else {
                pending.push({
                    account: accountId,
                    permitId: p.id,
                    permitStatus: p.status,
                    permitCreated: convertDate(p.createdAt),
                    permitIssued: convertDate(p.issuedAt),
                    permitExpired: convertDate(p.expiredAt),
                    permitCompleted: convertDate(p.completedAt)
                })
            }
        }
        console.timeEnd("prepare")

        if (pending.length > 0) {
            console.time("insert")
            await DB.Permit.bulkCreate(pending)
            console.timeEnd("insert")
        }


        if (waits.length > 0) {
            console.time("waiting")
            for (let p of waits) {
                await p
            }
            console.timeEnd("waiting")
        }
    });
    console.timeEnd("bulk_all")
}