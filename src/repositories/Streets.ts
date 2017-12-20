import { DB } from "../tables/index";
import { StreetAttributes, StreetSuffixes } from "../tables/Street";
import { StreetNumberAttributes } from "../tables/StreetNumber";
import { bulkInsert } from "../utils/db_utils";
import { Transaction } from "sequelize";
import { SelectBuilder } from "../utils/SelectBuilder";

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

async function _applyStreets(tx: Transaction, cityId: number, streets: StreetDescription[]) {
    let normalized = streets.map(s => ({
        streetName: normalizeStreet(s.streetName),
        streetNameSuffix: normalizeSuffix(s.streetNameSuffix)
    }))
    let comparator = (a: StreetDescription, b: StreetDescription) =>
        a.streetName === b.streetName && a.streetNameSuffix === b.streetNameSuffix
    return normalizedProcessor(normalized, comparator, async (normalized) => {
        let start = new Date()
        var res = Array<number>(normalized.length)
        var pending = Array<StreetAttributes>()
        var pendingIndex = Array<number>()
        var index = 0
        var tuples = normalized.map((n) => {
            return [n.streetName, n.streetNameSuffix] as any[]
        })
        let builder = new SelectBuilder(DB.Street)
            .withTx(tx)
            .whereEq("cityId", cityId)
        let withNull = builder
            .whereIn(['name', 'suffix'], tuples.filter((p) => p[1]))
            .findAllDirect()
        let woutNull = builder
            .whereIn(['name'], tuples.filter((p) => !p[1]).map(p => [p[0]]))
            .where("\"suffix\" IS NULL")
            .findAllDirect()
        let allStreets = [...(await withNull), ...(await woutNull)];
        // var allStreets = await findAllTuples(tx, cityId, ['name', 'suffix'], tuples, DB.Street)
        for (let str of normalized) {
            let existing = allStreets.find((p) => p.name === str.streetName && p.suffix == str.streetNameSuffix)
            if (existing == null) {
                pending.push({
                    cityId: cityId,
                    name: str.streetName,
                    suffix: str.streetNameSuffix as StreetSuffixes
                })
                pendingIndex.push(index)
            } else {
                res[index] = existing.id!!
            }
            index++
        }
        if (pending.length > 0) {
            index = 0
            for (let p of await bulkInsert(tx, DB.Street, pending)) {
                res[pendingIndex[index]] = p
                index++
            }
        }
        console.info(`Streets Imported in ${new Date().getTime() - start.getTime()}ms`)
        return res
    })
}

export async function applyStreets(cityId: number, streets: StreetDescription[]) {
    return await DB.tx(async (tx) => _applyStreets(tx, cityId, streets))
}

export async function applyStreetNumbers(cityId: number, streetNumbers: StreetNumberDescription[]) {
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
            let start = new Date()
            var res = Array<number>(data.length)
            let streets = await _applyStreets(tx, cityId, data)
            var index = 0

            var tuples = data.map((n, ind) => {
                return [streets[ind], n.streetNumber, n.streetNumberSuffix] as any[]
            })
            console.time("load_tuples")
            let builder = new SelectBuilder(DB.StreetNumber)
                .withTx(tx)
            let withNull = builder
                .whereIn(['streetId', 'number', 'suffix'], tuples.filter((p) => p[2]))
                .findAllDirect()
            let woutNull = builder
                .whereIn(['streetId', 'number'], tuples.filter((p) => !p[2]).map(p => [p[0], p[1]]))
                .where("\"suffix\" IS NULL")
                .findAllDirect()
            let allNumbers = [...(await withNull), ...(await woutNull)];

            var pending = Array<StreetNumberAttributes>();
            var pendingIndex = Array<number>()
            console.time("prepare_updates")
            for (let n of data) {
                let street = streets[index]
                let existing = allNumbers.find((p) => p.streetId == street && p.number == n.streetNumber && p.suffix == n.streetNumberSuffix)
                if (existing == null) {
                    pending.push({
                        streetId: street,
                        number: n.streetNumber,
                        suffix: n.streetNumberSuffix
                    })
                    pendingIndex.push(index)
                } else {
                    res[index] = existing.id!!
                }
                index++
            }
            console.timeEnd("prepare_updates")

            console.time("bulk_insert")
            if (pending.length > 0) {
                index = 0
                for (let p of await bulkInsert(tx, DB.StreetNumber, pending)) {
                    res[pendingIndex[index]] = p
                    index++
                }
            }
            console.timeEnd("bulk_insert")

            console.info(`Street Numbers imported in ${new Date().getTime() - start.getTime()}ms`)
            return res
        })
    })
}