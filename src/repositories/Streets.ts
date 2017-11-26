import { DB } from "../tables/index";
import { StreetAttributes, Street } from "../tables/Street";
import { StreetNumber, StreetNumberAttributes } from "../tables/StreetNumber";

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
        var tuples = normalized.map((n) => {
            return [n.streetName, n.streetNameSuffix] as any[]
        })
        var allStreets = await DB.findAllTuples(accountId, ['name', 'suffix'], tuples, DB.Street)
        for (let str of normalized) {
            let existing = allStreets.find((p) => p.name === str.streetName && p.suffix == str.streetNameSuffix)
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
            for (let p of await DB.Street.bulkCreate(pending, { returning: true })) {
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
            streetName: normalizeStreet(p.streetName),
            streetNameSuffix: normalizeSuffix(p.streetNameSuffix),
            streetNumber: p.streetNumber,
            streetNumberSuffix: normalizeSuffix(p.streetNumberSuffix)
        }))
        let comparator = (a: StreetNumberDescription, b: StreetNumberDescription) =>
            a.streetName === b.streetName && a.streetNameSuffix === b.streetNameSuffix &&
            a.streetNumber === b.streetNumber && a.streetNumberSuffix === b.streetNumberSuffix
        return normalizedProcessor(normalized, comparator, async (data) => {
            var res = Array<StreetNumber>(data.length)
            let streets = await _applyStreets(accountId, data)
            var index = 0

            var tuples = data.map((n, ind) => {
                return [streets[ind].id, n.streetNumber, n.streetNumberSuffix] as any[]
            })
            var allNumbers = await DB.findAllTuples(accountId, ['streetId', 'number', 'suffix'], tuples, DB.StreetNumber)

            var pending = Array<StreetNumberAttributes>();
            var pendingIndex = Array<number>()
            for (let n of data) {
                let street = streets[index]
                let existing = allNumbers.find((p) => p.streetId == street.id && p.number == n.streetNumber && p.suffix == n.streetNumberSuffix)
                if (existing == null) {
                    pending.push({
                        account: accountId,
                        streetId: street.id,
                        number: n.streetNumber,
                        suffix: n.streetNumberSuffix
                    })
                    pendingIndex.push(index)
                } else {
                    res[index] = existing
                }
                index++
            }
            if (pending.length > 0) {
                index = 0
                for (let p of await DB.StreetNumber.bulkCreate(pending, { returning: true })) {
                    res[pendingIndex[index]] = p
                    index++
                }
            }
            return res
        })
    })
}