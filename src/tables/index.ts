import { connection } from '../connector';
import * as sequelize from 'sequelize';

export { User } from './User';
export { Vote } from './Vote';
export { UserVote } from './UserVote';
export { Account } from './City';
export { Project } from './Project';
export { DataSet } from './DataSet';


import { UserTable } from './User';
import { VoteTable } from './Vote';
import { UserVoteTable } from './UserVote';
import { AccountTable } from './City';
import { ProjectTable } from './Project';
import { DataSetTable } from './DataSet';

export const DB = {
    User: UserTable,
    Vote: VoteTable,
    UserVote: UserVoteTable,
    Account: AccountTable,
    Project: ProjectTable,
    DataSet: DataSetTable,

    tx: async function tx<A>(handler: () => PromiseLike<A>): Promise<A> {
        return await connection.transaction((_: sequelize.Transaction) => handler());
    }
}