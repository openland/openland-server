import { connection } from '../connector';
import * as sequelize from 'sequelize';

export { User } from './User';
export { Vote } from './Vote';
export { UserVote } from './UserVote';
export { Account } from './Account';
export { AccountMember } from './Account';
export { Project } from './Project';
export { DataSet } from './DataSet';
export { Findings } from './Findings';
export { Street } from './Street';
export { StreetNumber } from './StreetNumber';
export { BuildingProject } from './BuildingProject';

import { UserTable } from './User';
import { VoteTable } from './Vote';
import { UserVoteTable } from './UserVote';
import { AccountTable } from './Account';
import { AccountMemberTable } from './Account';
import { ProjectTable } from './Project';
import { DataSetTable } from './DataSet';
import { FindingsTable } from './Findings';
import { PermitTable } from './Permit';
import { StreetTable } from './Street';
import { StreetNumberTable } from './StreetNumber';
import { BuildingProjectTable } from './BuildingProject';

export const DB = {
    User: UserTable,
    Vote: VoteTable,
    UserVote: UserVoteTable,
    Account: AccountTable,
    AccountMember: AccountMemberTable,
    Project: ProjectTable,
    DataSet: DataSetTable,
    Findings: FindingsTable,
    Permit: PermitTable,
    Street: StreetTable,
    StreetNumber: StreetNumberTable,
    BuidlingProject: BuildingProjectTable,

    tx: async function tx<A>(handler: (tx: sequelize.Transaction) => PromiseLike<A>): Promise<A> {
        return await connection.transaction({ isolationLevel: "SERIALIZABLE" }, (tx: sequelize.Transaction) => handler(tx));
    },
    findAllRaw: async function query<TInstance>(sql: string, model: sequelize.Model<TInstance, any>): Promise<TInstance[]> {
        return (await connection.query(sql, {
            model: model
        })) as TInstance[]
    },
    findAllTuplesWithNull: async function query<TInstance>(accountId: number, fields: string[], nullField: string, tuples: any[][], model: sequelize.Model<TInstance, any>): Promise<TInstance[]> {
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
        return this.findAllRaw(query, model)
    },
    findAllTuplesWithNotNull: async function query<TInstance>(accountId: number, fields: string[], tuples: any[][], model: sequelize.Model<TInstance, any>): Promise<TInstance[]> {
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
        return this.findAllRaw(query, model)
    },
    findAllTuples: async function query<TInstance>(accountId: number, fields: string[], tuples: any[][], model: sequelize.Model<TInstance, any>): Promise<TInstance[]> {
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
                return this.findAllTuplesWithNotNull(accountId, fields, tuples, model)
            } else if (withoutNulls.length == 0) {
                return this.findAllTuplesWithNull(accountId, notNullFields, nullable[0], withNulls, model)
            } else {
                let notNulledValues = await this.findAllTuplesWithNotNull(accountId, fields, withoutNulls, model)
                let nulledValues = await this.findAllTuplesWithNull(accountId, notNullFields, nullable[0], withNulls, model)
                return [...notNulledValues, ...nulledValues]
            }
        } else {
            console.warn(attributes)
            return this.findAllTuplesWithNotNull(accountId, fields, tuples, model)
        }
    },
    bulkAssociations: async function bulkAssociations(table: string, key1: string, key2: string, values: { value1: number, value2: number }[]) {
        let date = new Date().toUTCString()
        let sqlValues = values.map((v) => "('" + date + "','" + date + "'," + v.value1 + "," + v.value2 + ")").join()
        let query = "INSERT INTO \"" + table + "\" (\"createdAt\",\"updatedAt\",\"" + key1 + "\",\"" + key2 + "\") VALUES " + sqlValues + " ON CONFLICT DO NOTHING"
        await connection.query(query)
    }
}