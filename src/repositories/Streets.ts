import { DB } from "../tables/index";
import { StreetAttributes, Street } from "../tables/Street";
import { StreetNumber } from "../tables/StreetNumber";

export interface StreetDescription {
    streetName: string
    streetNameSuffix?: string
}

export interface StreetNumberDescription extends StreetDescription {
    streetNumber: number
    streetNumberSuffix?: string
}

export function normalizeStreet(str: string) {
    return str.trim().split(' ').map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' ')
}

export function normalizeSuffix(str?: string): string | undefined {
    if (str) {
        if (str.trim() == '') {
            return undefined
        }
        return normalizeStreet(str)
    }
    return undefined
}

async function _applyStreets(accountId: number, streets: StreetDescription[]) {
    var res = Array<Street>(streets.length)
    var pending = Array<StreetAttributes>()
    var pendingIndex = Array<number>()
    var index = 0
    for (let str of streets) {
        console.warn(str);
        let nstr = normalizeStreet(str.streetName)
        let nsf = normalizeSuffix(str.streetNameSuffix)
        let existing = await DB.Street.find({
            where: {
                account: accountId,
                name: nstr,
                suffix: nsf
            },
        })
        if (existing == null) {
            pending.push({
                account: accountId,
                name: nstr,
                suffix: nsf
            })
            pendingIndex.push(index)
        } else {
            res[index] = existing
        }
        index++
    }
    if (pending.length > 0) {
        index = 0
        for (let p of await DB.Street.bulkCreate(pending)) {
            res[pendingIndex[index]] = p
            index++
        }
    }
    return res
}

export async function applyStreets(accountId: number, streets: StreetDescription[]) {
    return await DB.tx(async (tx) => _applyStreets(accountId, streets))
}

export async function applyStreetNumbers(accountId: number, streetNumbers: StreetNumberDescription[]) {
    return await DB.tx(async (tx) => {
        var res = Array<StreetNumber>()
        let streets = await _applyStreets(accountId, streetNumbers)
        var index = 0
        for (let n of streetNumbers) {
            let street = streets[index]
            let suffix = normalizeSuffix(n.streetNumberSuffix)
            let existing = await DB.StreetNumber.findOne({
                where: {
                    account: accountId,
                    street: street.id,
                    number: n.streetNumber,
                    suffix: suffix
                }
            })
            if (existing == null) {
                res.push(await DB.StreetNumber.create({
                    account: accountId,
                    street: street.id,
                    number: n.streetNumber,
                    suffix: suffix
                }))
            } else {
                res.push(existing)
            }
            index++
        }
        return res
    })
}