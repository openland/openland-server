import * as sequelize from 'sequelize'
import { connection } from '../connector'

export async function findAllRaw<TInstance>(sql: string, model: sequelize.Model<TInstance, any>): Promise<TInstance[]> {
    return (await connection.query(sql, { model: model, raw: true, logging: false })) as TInstance[]
}

async function findAllTuplesWithNull<TInstance>(accountId: number, fields: string[], nullField: string, tuples: any[][], model: sequelize.Model<TInstance, any>): Promise<TInstance[]> {
    var attributes = (model as any).attributes
    var sqlFields = '(' + fields.map((p) => {
        let attr = attributes[p]
        if (!attr) {
            throw "Attribute " + p + " not found"
        }
        return '"' + p + '"'
    }).join() + ')'
    var sqlTuples = '(' + tuples.map((p) =>
        '(' + p.map((v) => {
            if (v == null || v == undefined) {
                console.warn(p)
                throw "Null value found!"
            } else if (typeof v === "string") {
                return connection.escape(v)
            } else {
                return v
            }
        }).join() + ')'
    ).join() + ')'
    var query = 'SELECT * from "' + model.getTableName() + '" ' +
        'WHERE "account" = ' + accountId + 'AND ' + nullField + ' IS NULL AND ' +
        sqlFields + ' in ' + sqlTuples;
    return findAllRaw(query, model)
}

async function findAllTuplesWithNotNull<TInstance>(accountId: number, fields: string[], tuples: any[][], model: sequelize.Model<TInstance, any>): Promise<TInstance[]> {
    var attributes = (model as any).attributes

    var sqlFields = '(' + fields.map((p) => {
        let attr = attributes[p]
        if (!attr) {
            throw "Attribute " + p + " not found"
        }
        return '"' + p + '"'
    }).join() + ')'
    var sqlTuples = '(' + tuples.map((p) =>
        '(' + p.map((v) => {
            if (v == null || v == undefined) {
                console.warn(p)
                throw "Null value found!"
            } else if (typeof v === "string") {
                return connection.escape(v)
            } else {
                return v
            }
        }).join() + ')'
    ).join() + ')'
    var query = 'SELECT * from "' + model.getTableName() + '" ' +
        'WHERE "account" = ' + accountId + ' AND ' +
        sqlFields + ' in ' + sqlTuples;
    return findAllRaw(query, model)
}
export async function findAllTuples<TInstance>(accountId: number, fields: string[], tuples: any[][], model: sequelize.Model<TInstance, any>): Promise<TInstance[]> {
    var attributes = (model as any).attributes
    let nullable = fields.filter((p) => (attributes[p].allowNull && attributes[p].type.constructor.name === "STRING"))
    if (nullable.length >= 2) {
        throw "More than one nullable is not supported!"
    } else if (nullable.length == 1) {
        var withNulls = Array<Array<any>>()
        var withoutNulls = Array<Array<any>>()
        var notNullFields = fields.filter((p) => p !== nullable[0])
        for (let t of tuples) {
            if (t.filter((p2: any) => p2 === null || p2 === undefined).length > 0) {
                withNulls.push(t.filter((p2: any) => p2 != null && p2 != undefined))
            } else {
                withoutNulls.push(t)
            }
        }

        if (withNulls.length == 0) {
            return findAllTuplesWithNotNull(accountId, fields, tuples, model)
        } else if (withoutNulls.length == 0) {
            return findAllTuplesWithNull(accountId, notNullFields, nullable[0], withNulls, model)
        } else {
            let notNulledValues = await findAllTuplesWithNotNull(accountId, fields, withoutNulls, model)
            let nulledValues = await findAllTuplesWithNull(accountId, notNullFields, nullable[0], withNulls, model)
            return [...notNulledValues, ...nulledValues]
        }
    } else {
        return findAllTuplesWithNotNull(accountId, fields, tuples, model)
    }
}
export async function bulkAssociations(table: string, key1: string, key2: string, values: { value1: number, value2: number }[]) {
    let date = new Date().toUTCString()
    let sqlValues = values.map((v) => "('" + date + "','" + date + "'," + v.value1 + "," + v.value2 + ")").join()
    let query = "INSERT INTO \"" + table + "\" (\"createdAt\",\"updatedAt\",\"" + key1 + "\",\"" + key2 + "\") VALUES " + sqlValues + " ON CONFLICT DO NOTHING"
    await connection.query(query, { logging: false })
}

export async function bulkInsert<TRow>(model: sequelize.Model<any, TRow> | string, rows: TRow[], options?: { inlcudeDates?: boolean }): Promise<number[]> {
    var includeDates = options ? options.inlcudeDates ? options.inlcudeDates : true : true
    if (includeDates) {
        let date = new Date().toUTCString()
        rows = rows.map(p => ({ ...(p as any), createdAt: date, updatedAt: date }))
    }
    let table = (typeof (model) === "string") ? model : model.getTableName() as string
    let res = await connection.getQueryInterface().bulkInsert(table, rows, { raw: true, returning: true, logging: true }) as { id: number }[]
    return res.map(p => p.id)
}

export function escape(value: any): string {
    if (value) {
        if (value === null) {
            return "NULL"
        } else if (typeof (value) === "string") {
            return connection.escape(value)
        } else {
            return "" + value
        }
    } else {
        return "NULL"
    }
}

// function loadFields<TRow>(src: TRow, fields: string[]) {
//     return `(${fields.map(p => escape((src as any)[p])).join()})`
// }

function loadField<TRow>(src: TRow, field: string) {
    return escape((src as any)[field])
}

function loadFieldValue<TRow>(src: TRow, field: string) {
    return (src as any)[field]
}

function saveFieldValue<TRow>(src: TRow, field: string, value: any) {
    (src as any)[field] = value
}

function valueEquals(a: any, b: any) {
    if ((a == undefined || a == null) && (b == undefined || b == null)) {
        return true
    } else if ((a == undefined || a == null) && (b != undefined && b != null)) {
        return false
    } else if ((b == undefined || b == null) && (a != undefined && a != null)) {
        return false
    } else {
        return a === b
    }
}

export async function bulkApply<TRow extends { id?: number, account?: number }>(model: sequelize.Model<any, TRow>, accountId: number, key: string, rows: TRow[]) {
    let query = `SELECT * from ${model.getTableName()} WHERE "account" = ${accountId} AND "${key}" IN (${rows.map(r => `${loadField(r, key)}`).join()})`
    let existing = (await connection.query(query))[1].rows as TRow[]
    var forInsert = Array<TRow>()
    var forUpdate = Array<PromiseLike<any>>()
    var indexes = Array<number>(rows.length)
    var pendingIndexes = Array<number>()
    var map: { [key: string]: TRow } = {}
    for (let p of existing) {
        map[loadFieldValue(p, key)] = p
    }
    var index = 0
    for (let row of rows) {
        let ex = map[loadFieldValue(row, key)]
        let names = Object.getOwnPropertyNames(row)
        if (ex) {
            indexes[index] = ex.id!!
            var updated: TRow = { } as TRow
            var wasChanged = false
            for (let n of names) {
                if (n == key || n == "account") {
                    continue
                }
                let v = loadFieldValue(row, n)
                let v2 = loadFieldValue(ex, n)

                if (!valueEquals(v, v2)) {
                    saveFieldValue(updated, n, v)
                    wasChanged = true
                }
            }
            if (wasChanged) {
                forUpdate.push(model.update(updated, {
                    where: {
                        id: ex.id!!
                    }
                }))
            }
        } else {
            forInsert.push({ ...(row as any), account: accountId })
            pendingIndexes.push(index)
        }
        index++
    }

    if (forInsert.length > 0) {
        index = 0
        for (let ind of await bulkInsert(model, forInsert)) {
            indexes[pendingIndexes[index]] = ind
            index++
        }
    }

    if (forUpdate.length > 0) {
        for (let p of forUpdate) {
            await p
        }
    }
    return indexes
}