import * as sequelize from 'sequelize';
import { connection } from '../connector';
import { Transaction } from 'sequelize';
import { DB } from '../tables';

export interface Applied<T> {
    id: number;
    created: boolean;
    changed: boolean;
    oldValue?: T;
    newValue?: T;
    changedFields?: string[];
}

export async function findAllRaw<TInstance>(sql: string, model: sequelize.Model<TInstance, any>, tx?: Transaction): Promise<TInstance[]> {
    return (await connection.query(sql, {model: model, raw: true, logging: false, transaction: tx})) as TInstance[];
}

async function findAllTuplesWithNull<TInstance>(tx: Transaction, accountId: number, fields: string[], nullField: string, tuples: any[][], model: sequelize.Model<TInstance, any>): Promise<TInstance[]> {
    let attributes = (model as any).attributes;
    let sqlFields = '(' + fields.map((p) => {
        let attr = attributes[p];
        if (!attr) {
            throw 'Attribute ' + p + ' not found';
        }
        return '"' + p + '"';
    }).join() + ')';
    let sqlTuples = '(' + tuples.map((p) =>
        '(' + p.map((v) => {
            if (v == null || v === undefined) {
                console.warn(p);
                throw 'Null value found!';
            } else if (typeof v === 'string') {
                return connection.escape(v);
            } else {
                return v;
            }
        }).join() + ')'
    ).join() + ')';
    let query = 'SELECT * from "' + model.getTableName() + '" ' +
        'WHERE "account" = ' + accountId + 'AND ' + nullField + ' IS NULL AND ' +
        sqlFields + ' in ' + sqlTuples;
    return findAllRaw(query, model, tx);
}

async function findAllTuplesWithNotNull<TInstance>(tx: Transaction, accountId: number, fields: string[], tuples: any[][], model: sequelize.Model<TInstance, any>): Promise<TInstance[]> {
    let attributes = (model as any).attributes;

    let sqlFields = '(' + fields.map((p) => {
        let attr = attributes[p];
        if (!attr) {
            throw 'Attribute ' + p + ' not found';
        }
        return '"' + p + '"';
    }).join() + ')';
    let sqlTuples = '(' + tuples.map((p) =>
        '(' + p.map((v) => {
            if (v == null || v === undefined) {
                console.warn(p);
                throw 'Null value found!';
            } else if (typeof v === 'string') {
                return connection.escape(v);
            } else {
                return v;
            }
        }).join() + ')'
    ).join() + ')';
    let query = 'SELECT * from "' + model.getTableName() + '" ' +
        'WHERE "account" = ' + accountId + ' AND ' +
        sqlFields + ' in ' + sqlTuples;
    return findAllRaw(query, model, tx);
}

export async function findAllTuples<TInstance>(tx: Transaction, accountId: number, fields: string[], tuples: any[][], model: sequelize.Model<TInstance, any>): Promise<TInstance[]> {
    let attributes = (model as any).attributes;
    let nullable = fields.filter((p) => (attributes[p].allowNull && attributes[p].type.constructor.name === 'STRING'));
    if (nullable.length >= 2) {
        throw 'More than one nullable is not supported!';
    } else if (nullable.length === 1) {
        let withNulls = Array<Array<any>>();
        let withoutNulls = Array<Array<any>>();
        let notNullFields = fields.filter((p) => p !== nullable[0]);
        for (let t of tuples) {
            if (t.filter((p2: any) => p2 === null || p2 === undefined).length > 0) {
                withNulls.push(t.filter((p2: any) => p2 != null && p2 !== undefined));
            } else {
                withoutNulls.push(t);
            }
        }

        if (withNulls.length === 0) {
            return findAllTuplesWithNotNull(tx, accountId, fields, tuples, model);
        } else if (withoutNulls.length === 0) {
            return findAllTuplesWithNull(tx, accountId, notNullFields, nullable[0], withNulls, model);
        } else {
            let notNulledValues = await findAllTuplesWithNotNull(tx, accountId, fields, withoutNulls, model);
            let nulledValues = await findAllTuplesWithNull(tx, accountId, notNullFields, nullable[0], withNulls, model);
            return [...notNulledValues, ...nulledValues];
        }
    } else {
        return findAllTuplesWithNotNull(tx, accountId, fields, tuples, model);
    }
}

export async function bulkAssociations(tx: Transaction, table: string, key1: string, key2: string, values: { value1: number, value2: number }[]) {
    let date = new Date().toUTCString();
    let sqlValues = values.map((v) => `('${date}','${date}',${v.value1},${v.value2})`).join();
    let query = 'INSERT INTO \"' + table + '\" ("createdAt","updatedAt",\"' + key1 + '\",\"' + key2 + '\") VALUES ' + sqlValues + ' ON CONFLICT DO NOTHING';
    await connection.query(query, {logging: false, transaction: tx});
}

export async function bulkInsert<TRow>(tx: Transaction, model: sequelize.Model<any, TRow> | string, rows: TRow[], options?: { inlcudeDates?: boolean }): Promise<number[]> {
    let includeDates = options ? options.inlcudeDates ? options.inlcudeDates : true : true;
    if (includeDates) {
        let date = new Date().toUTCString();
        rows = rows.map(p => ({...(p as any), createdAt: date, updatedAt: date}));
    }
    let table = (typeof (model) === 'string') ? model : model.getTableName() as string;
    let res = await connection.getQueryInterface().bulkInsert(table, rows, {
        raw: true,
        returning: true,
        logging: true,
        transaction: tx
    }) as { id: number }[];
    return res.map(p => p.id);
}

export function escape(value: any): string {
    if (value) {
        if (value === null) {
            return 'NULL';
        } else if (typeof (value) === 'string') {
            return connection.escape(value);
        } else {
            return '' + value;
        }
    } else {
        return 'NULL';
    }
}

// function loadFields<TRow>(src: TRow, fields: string[]) {
//     return `(${fields.map(p => escape((src as any)[p])).join()})`
// }

function loadField<TRow>(src: TRow, field: string) {
    return escape((src as any)[field]);
}

function loadFieldValue<TRow>(src: TRow, field: string) {
    return (src as any)[field];
}

function saveFieldValue<TRow>(src: TRow, field: string, value: any) {
    (src as any)[field] = value;
}

function valueEquals(a: any, b: any) {
    if ((a === undefined || a == null) && (b === undefined || b == null)) {
        return true;
    } else if ((a === undefined || a == null) && (b !== undefined && b != null)) {
        return false;
    } else if ((b === undefined || b == null) && (a !== undefined && a != null)) {
        return false;
    } else {
        return a === b;
    }
}

export async function bulkApply<TRow extends { id?: number, account?: number }>(tx: Transaction, model: sequelize.Model<any, TRow>, accountId: number, key: string, rows: TRow[]) {
    let query = `SELECT * from ${model.getTableName()} WHERE "account" = ${accountId} AND "${key}" IN (${rows.map(r => `${loadField(r, key)}`).join()})`;
    let existing = (await connection.query(query, {transaction: tx, logging: false}))[1].rows as TRow[];
    let forInsert: TRow[] = [];
    let forUpdate: PromiseLike<any>[] = [];
    let indexes = new Array<Applied<TRow>>(rows.length);
    let pendingIndexes: number[] = [];
    let map: { [key: string]: TRow } = {};
    for (let p of existing) {
        map[loadFieldValue(p, key)] = p;
    }
    let index = 0;
    for (let row of rows) {
        let ex = map[loadFieldValue(row, key)];
        let names = Object.getOwnPropertyNames(row);
        if (ex) {
            let updated: TRow = {} as TRow;
            let wasChanged = false;
            let changed = [];
            for (let n of names) {
                if (n === key || n === 'account') {
                    continue;
                }
                let v = loadFieldValue(row, n);
                let v2 = loadFieldValue(ex, n);

                if ((v !== undefined) && !valueEquals(v, v2)) {
                    console.warn('Changed ' + n);
                    console.warn(v2 + ' -> ' + v);
                    saveFieldValue(updated, n, v);
                    wasChanged = true;
                    changed.push(n);
                }
            }
            if (wasChanged) {
                forUpdate.push(model.update(updated, {
                    where: {
                        id: ex.id!!
                    },
                    transaction: tx
                }));
                indexes[index] = {
                    id: ex.id!!,
                    changed: true,
                    created: false,
                    oldValue: ex,
                    newValue: row,
                    changedFields: changed
                };
            } else {
                indexes[index] = {
                    id: ex.id!!,
                    changed: false,
                    created: false
                };
            }
        } else {
            forInsert.push({...(row as any), account: accountId});
            pendingIndexes.push(index);
        }
        index++;
    }

    if (forInsert.length > 0) {
        index = 0;
        for (let ind of await bulkInsert(tx, model, forInsert)) {
            indexes[pendingIndexes[index]] = {
                id: ind,
                created: true,
                changed: false
            };
            index++;
        }
    }

    if (forUpdate.length > 0) {
        for (let p of forUpdate) {
            await p;
        }
    }
    return indexes;
}

export function textLikeFields(query: string, fields: string[]) {
    if (fields.length === 1) {
        return textLikeField(query, fields[0]);
    } else {
        return DB.connection.or(...fields.map(p => textLikeField(query, p)));
    }
}

export function textLikeFieldsText(query: string, fields: string[]) {
    if (fields.length === 1) {
        return textLikeFieldText(query, fields[0]);
    } else {
        return '(' + fields.map(p => textLikeFieldText(query, p)).join(' OR ') + ')';
    }
}

export function textLikeField(query: string, field: string) {
    query = query.toLowerCase().trim()
        .replace('%', '[%]')
        .replace('[', '[[]')
        .replace('\'', '[\']');
    let sq = DB.connection;
    let column = sq.fn('lower', sq.col(field));
    return sq.or(
        sq.where(column, {
            $like: query + '%'
        }),
        sq.where(column, {
            $like: '% ' + query + '%'
        })
    );
}

export function textLikeFieldText(query: string, field: string) {
    query = query.toLowerCase().trim()
        .replace('%', '[%]')
        .replace('[', '[[]')
        .replace('\'', '[\']');

    return '(lower(\"' + field + '\") LIKE \'' + query + '%\' OR lower(\"' + field + '\") LIKE \'% ' + query + '%\')';
}

export async function sumRaw(table: string, field: string, where: string | null): Promise<number> {
    let q = 'SELECT SUM(' + field + ') FROM \"' + table + '\"' + (where ? ' WHERE ' + where : '');
    console.warn(q);
    return (await DB.connection.query(q, {type: DB.connection.QueryTypes.SELECT}))[0].sum || 0;
}

export async function countRaw(table: string, where: string | null): Promise<number> {
    let q = 'SELECT COUNT(*) FROM \"' + table + '\"' + (where ? ' WHERE ' + where : '');
    console.warn(q);
    return (await DB.connection.query(q, {type: DB.connection.QueryTypes.SELECT}))[0].count || 0;
}

export async function percentileRaw(table: string, percentiles: [number], order: string, where: string | null): Promise<number[]> {
    let q = 'SELECT percentile_disc(array[' + percentiles.join() + '])  WITHIN GROUP (ORDER BY ' + order + ') FROM \"' + table + '\"' + (where ? ' WHERE ' + where : '');
    console.warn(q);
    let r = (await DB.connection.query(q, {type: DB.connection.QueryTypes.SELECT}))[0].percentile_disc;
    if (!r) {
        r = [];
    }
    console.warn(r);
    return r;
}

export async function histogramCountRaw(table: string, order: string, where: string | null): Promise<{ count: number, value: number }[]> {
    let q = 'SELECT count(*) as "count", ' + order + ' as "value" FROM \"' + table + '\"' + (where ? ' WHERE ' + where : '') + ' GROUP BY ' + order + ' ORDER BY ' + order;
    console.warn(q);
    let r = (await DB.connection.query(q, {type: DB.connection.QueryTypes.SELECT})) as { count: string, value: number }[];
    if (!r) {
        r = [];
    }
    console.warn(r);
    return r.map((v) => ({count: parseInt(v.count, 10), value: v.value}));
}

export async function histogramSumRaw(table: string, order: string, field: string, where: string | null): Promise<{ count: number, value: number }[]> {
    let q = 'SELECT sum("' + field + '") as "count", ' + order + ' as "value" FROM \"' + table + '\"' + (where ? ' WHERE ' + where : '') + ' GROUP BY ' + order + ' ORDER BY ' + order;
    console.warn(q);
    let r = (await DB.connection.query(q, {type: DB.connection.QueryTypes.SELECT})) as { count: string, value: number }[];
    if (!r) {
        r = [];
    }
    console.warn(r);
    return r.map((v) => ({count: parseInt(v.count, 10), value: v.value}));
}