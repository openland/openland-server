import { DB } from '../tables';
import { StreetAttributes, StreetSuffixes } from '../tables/Street';
import { StreetNumberAttributes } from '../tables/StreetNumber';
import { bulkInsert } from '../utils/db_utils';
import { Transaction } from 'sequelize';
import { SelectBuilder } from '../modules/SelectBuilder';

export interface StreetDescription {
    streetName: string;
    streetNameSuffix?: string | null;
}

export interface StreetNumberDescription extends StreetDescription {
    streetNumber: number;
    streetNumberSuffix?: string | null;
}

export function normalizeStreet(str: string) {
    return str.trim().split(' ').map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' ');
}

export function normalizeSuffix(str?: string | null): string | null {
    if (str) {
        if (str.trim() === '') {
            return null;
        }
        return normalizeStreet(str);
    }
    return null;
}

async function normalizedProcessor<T1, T2>(array: T1[], compare: (a: T1, b: T1) => boolean, processor: (data: T1[]) => Promise<T2[]>): Promise<T2[]> {
    let normalized = Array<T1>();
    let indexes = Array<number>();
    for (let i = 0; i < array.length; i++) {
        let founded = false;
        for (let j = 0; j < normalized.length; j++) {
            if (compare(array[i], normalized[j])) {
                founded = true;
                indexes.push(j);
                break;
            }
        }
        if (!founded) {
            indexes.push(normalized.length);
            normalized.push(array[i]);
        }
    }
    let processed = await processor(normalized);
    let res = Array<T2>(array.length);
    for (let i2 = 0; i2 < array.length; i2++) {
        res[i2] = processed[indexes[i2]];
    }
    return res;
}

async function _applyStreets(tx: Transaction, cityId: number, streets: StreetDescription[]) {
    let streetsNormalized = streets.map(s => ({
        streetName: normalizeStreet(s.streetName),
        streetNameSuffix: normalizeSuffix(s.streetNameSuffix)
    }));
    let comparator = (a: StreetDescription, b: StreetDescription) =>
        a.streetName === b.streetName && a.streetNameSuffix === b.streetNameSuffix;
    return normalizedProcessor(streetsNormalized, comparator, async (normalized) => {
        let start = new Date();
        let res = Array<number>(normalized.length);
        let pending = Array<StreetAttributes>();
        let pendingIndex = Array<number>();
        let index = 0;
        let tuples = normalized.map((n) => {
            return [n.streetName, n.streetNameSuffix] as any[];
        });
        let builder = new SelectBuilder(DB.Street)
            .withTx(tx)
            .whereEq('cityId', cityId);
        let withNull = builder
            .whereIn(['name', 'suffix'], tuples.filter((p) => p[1]))
            .findAllDirect();
        let woutNull = builder
            .whereIn(['name'], tuples.filter((p) => !p[1]).map(p => [p[0]]))
            .where('"suffix" IS NULL')
            .findAllDirect();
        let allStreets = [...(await withNull), ...(await woutNull)];
        // var allStreets = await findAllTuples(tx, cityId, ['name', 'suffix'], tuples, DB.Street)
        for (let str of normalized) {
            let existing = allStreets.find((p) =>
                p.name === str.streetName && p.suffix === str.streetNameSuffix);
            if (existing == null) {
                pending.push({
                    cityId: cityId,
                    name: str.streetName,
                    suffix: str.streetNameSuffix as StreetSuffixes
                });
                pendingIndex.push(index);
            } else {
                res[index] = existing.id!!;
            }
            index++;
        }
        if (pending.length > 0) {
            index = 0;
            for (let p of await bulkInsert(tx, DB.Street, pending)) {
                res[pendingIndex[index]] = p;
                index++;
            }
        }
        console.info(`Streets Imported in ${new Date().getTime() - start.getTime()}ms`);
        return res;
    });
}

export async function applyStreets(cityId: number, streets: StreetDescription[]) {
    return await DB.tx(async (tx) => _applyStreets(tx, cityId, streets));
}

export async function applyStreetNumbersInTx(tx: Transaction, cityId: number, streetNumbers: StreetNumberDescription[]) {
    let normalized = streetNumbers.map((p) => ({
        streetName: normalizeStreet(p.streetName),
        streetNameSuffix: normalizeSuffix(p.streetNameSuffix),
        streetNumber: p.streetNumber,
        streetNumberSuffix: normalizeSuffix(p.streetNumberSuffix)
    }));
    let comparator = (a: StreetNumberDescription, b: StreetNumberDescription) =>
        a.streetName === b.streetName && a.streetNameSuffix === b.streetNameSuffix &&
        a.streetNumber === b.streetNumber && a.streetNumberSuffix === b.streetNumberSuffix;
    return normalizedProcessor(normalized, comparator, async (data) => {
        let start = new Date();
        let res = Array<number>(data.length);
        let streets = await _applyStreets(tx, cityId, data);
        let index = 0;

        let tuples = data.map((n, ind) => {
            return [streets[ind], n.streetNumber, n.streetNumberSuffix] as any[];
        });
        console.time('load_tuples');
        let builder = new SelectBuilder(DB.StreetNumber)
            .withTx(tx);
        let withNull = builder
            .whereIn(['streetId', 'number', 'suffix'], tuples.filter((p) => p[2]))
            .findAllDirect();
        let woutNull = builder
            .whereIn(['streetId', 'number'], tuples.filter((p) => !p[2]).map(p => [p[0], p[1]]))
            .where('"suffix" IS NULL')
            .findAllDirect();
        let allNumbers = [...(await withNull), ...(await woutNull)];

        let pending = Array<StreetNumberAttributes>();
        let pendingIndex = Array<number>();
        console.time('prepare_updates');
        for (let n of data) {
            let street = streets[index];
            let existing = allNumbers.find((p) =>
                p.streetId === street && p.number === n.streetNumber && p.suffix === n.streetNumberSuffix);
            if (existing == null) {
                pending.push({
                    streetId: street,
                    number: n.streetNumber,
                    suffix: n.streetNumberSuffix
                });
                pendingIndex.push(index);
            } else {
                res[index] = existing.id!!;
            }
            index++;
        }
        console.timeEnd('prepare_updates');
        console.warn(pending);
        console.time('bulk_insert');
        if (pending.length > 0) {
            index = 0;
            for (let p of await bulkInsert(tx, DB.StreetNumber, pending)) {
                res[pendingIndex[index]] = p;
                index++;
            }
        }
        console.timeEnd('bulk_insert');

        console.info(`Street Numbers imported in ${new Date().getTime() - start.getTime()}ms`);
        return res;
    });
}

export async function applyStreetNumbers(cityId: number, streetNumbers: StreetNumberDescription[]) {
    return await DB.tx(async (tx) => {
        return applyStreetNumbersInTx(tx, cityId, streetNumbers);
    });
}