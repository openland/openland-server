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

    tx: async function tx<A>(handler: (tx: sequelize.Transaction) => PromiseLike<A>): Promise<A> {
        return await connection.transaction({ isolationLevel: "SERIALIZABLE" }, (tx: sequelize.Transaction) => handler(tx));
    },
    findAllRaw: async function query<TInstance>(sql: string, model: sequelize.Model<TInstance, any>): Promise<TInstance[]> {
        return (await connection.query(sql, {
            model: model
        })) as TInstance[]
    },
    findAllTuples: async function query<TInstance>(accountId: number, fields: string[], tuples: any[][], model: sequelize.Model<TInstance, any>): Promise<TInstance[]> {
        // normalized.map((n) => ('("' +  connection.escape(n.streetName) + '", '))

        var attributes = (model as any).attributes

        var sqlFields = '(' + fields.map((p) => {
            let attr = attributes[p]
            if (!attr) {
                throw "Attribute " + p + " not found"
            }
            if (attr.type.constructor.name == 'STRING' && attr.allowNull) {
                return "COALESCE(\"" + p + "\", '!#NULLL')"
            }
            return '"' + p + '"'
        }).join() + ')'
        var sqlTuples = '(' + tuples.map((p) =>
            '(' + p.map((v) => {
                if (v == null || v == undefined) {
                    return "'!#NULLL'"
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
    }
}