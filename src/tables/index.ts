import { connection } from '../connector';
import * as sequelize from 'sequelize';

import { UserTable } from './User';
import { VoteTable } from './Vote';
import { UserVoteTable } from './UserVote';
import { CityTable } from './City';
import { ProjectTable } from './Project';
import { DataSetTable } from './DataSet';

export const DB = {
    User: UserTable,
    Vote: VoteTable,
    UserVote: UserVoteTable,
    City: CityTable,
    Project: ProjectTable,
    DataSet: DataSetTable,

    tx: async function tx<A>(handler: () => PromiseLike<A>): Promise<A> {
        return await connection.transaction((_: sequelize.Transaction) => handler());
    }
}