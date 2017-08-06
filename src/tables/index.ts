import { connection } from '../connector';
import * as sequelize from 'sequelize';

import { UserTable } from './User';
import { VoteTable } from './Vote';
import { UserVoteTable } from './UserVote';
import { DashboardTable } from './Dashboard';
import { CityTable } from './City';
import { CounterTable, CounterValueTable } from './Counter';

export const DB = {
    User: UserTable,
    Vote: VoteTable,
    UserVote: UserVoteTable,
    Dashboard: DashboardTable,
    City: CityTable,
    Counter: CounterTable,
    CounterValue: CounterValueTable,
    tx: async function tx<A>(handler: () => PromiseLike<A>): Promise<A> {
        return await connection.transaction((_: sequelize.Transaction) => handler());
    }
}