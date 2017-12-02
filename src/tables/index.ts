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
export { AirTable } from './AirTable';

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
import { AirTableTable } from './AirTable';

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
    AirTable: AirTableTable,

    tx: async function tx<A>(handler: (tx: sequelize.Transaction) => PromiseLike<A>): Promise<A> {
        return await connection.transaction({ isolationLevel: "SERIALIZABLE" }, (tx: sequelize.Transaction) => handler(tx));
    }
}