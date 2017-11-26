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

async function normalizedProcessor<T1, T2>(array: T1[], compare: (a: T1, b: T1) => boolean, processor: (data: T1[]) => Promise<T2[]>): Promise<T2[]> {
    var normalized = Array<T1>()
    var indexes = Array<number>()
    for (var i = 0; i < array.length; i++) {
        var founded = false
        for (var j = 0; j < normalized.length; j++) {
            if (compare(array[i], normalized[j])) {
                founded = true
                indexes.push(j)
                break
            }
        }
        if (!founded) {
            indexes.push(normalized.length)
            normalized.push(array[i])
        }
    }
    var processed = await processor(normalized)
    var res = Array<T2>(array.length)
    for (var i = 0; i < array.length; i++) {
        res[i] = processed[indexes[i]]
    }
    return res
}

async function _applyStreets(accountId: number, streets: StreetDescription[]) {
    let normalized = streets.map(s => ({
        streetName: normalizeStreet(s.streetName),
        streetNameSuffix: normalizeSuffix(s.streetNameSuffix)
    }))
    let comparator = (a: StreetDescription, b: StreetDescription) =>
        a.streetName === b.streetName && a.streetNameSuffix === b.streetNameSuffix
    return normalizedProcessor(normalized, comparator, async (normalized) => {
        var res = Array<Street>(normalized.length)
        var pending = Array<StreetAttributes>()
        var pendingIndex = Array<number>()
        var index = 0
        for (let str of normalized) {
            let existing = await DB.Street.find({
                where: {
                    account: accountId,
                    name: str.streetName,
                    suffix: str.streetNameSuffix
                },
            })
            if (existing == null) {
                pending.push({
                    account: accountId,
                    name: str.streetName,
                    suffix: str.streetNameSuffix
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
    })
}

export async function applyStreets(accountId: number, streets: StreetDescription[]) {
    return await DB.tx(async (tx) => _applyStreets(accountId, streets))
}

export async function applyStreetNumbers(accountId: number, streetNumbers: StreetNumberDescription[]) {
    return await DB.tx(async (tx) => {
        let normalized = streetNumbers.map((p) => ({
            streetName: p.streetName,
            streetNameSuffix: p.streetNameSuffix,
            streetNumber: p.streetNumber,
            streetNumberSuffix: normalizeSuffix(p.streetNumberSuffix)
        }))
        let comparator = (a: StreetNumberDescription, b: StreetNumberDescription) =>
            a.streetName === b.streetName && a.streetNameSuffix === b.streetNameSuffix &&
            a.streetNumber === b.streetNumber && a.streetNumberSuffix === b.streetNumberSuffix
        return normalizedProcessor(normalized, comparator, async (data) => {
            var res = Array<StreetNumber>()
            let streets = await _applyStreets(accountId, streetNumbers)
            var index = 0
            for (let n of data) {
                let street = streets[index]
                let existing = await DB.StreetNumber.findOne({
                    where: {
                        account: accountId,
                        street: street.id,
                        number: n.streetNumber,
                        suffix: n.streetNumberSuffix
                    }
                })
                if (existing == null) {
                    res.push(await DB.StreetNumber.create({
                        account: accountId,
                        street: street.id,
                        number: n.streetNumber,
                        suffix: n.streetNumberSuffix
                    }))
                } else {
                    res.push(existing)
                }
                index++
            }
            return res
        })
    })
}