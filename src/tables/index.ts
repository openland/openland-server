import { connection } from '../connector';
import * as sequelize from 'sequelize';

export { User } from './User';
export { Account } from './Account';
export { AccountMember } from './Account';
export { Project } from './Project';
export { DataSet } from './DataSet';
export { Findings } from './Findings';
export { Street } from './Street';
export { StreetNumber } from './StreetNumber';
export { BuildingProject } from './BuildingProject';
export { AirTable } from './AirTable';
export { PermitEvent } from './PermitEvents';
export { Developer } from './Developer';
export { Constructor } from './Constructor';
export { State } from './State';
export { County } from './County';
export { City } from './City';

import { UserTable } from './User';
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
import { PermitEventsTable } from './PermitEvents';
import { DeveloperTable } from './Developer';
import { ConstructorTable } from './Constructor';
import { StateTable } from './State';
import { CountyTable } from './County';
import { CityTable } from './City';

export const DB = {
    User: UserTable,
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
    PermitEvents: PermitEventsTable,
    Developer: DeveloperTable,
    Constructor: ConstructorTable,
    State: StateTable,
    County: CountyTable,
    City: CityTable,

    tx: async function tx<A>(handler: (tx: sequelize.Transaction) => PromiseLike<A>): Promise<A> {
        return await connection.transaction({isolationLevel: 'SERIALIZABLE'}, (tx: sequelize.Transaction) => handler(tx));
    },
    txSilent: async function tx<A>(handler: (tx: sequelize.Transaction) => PromiseLike<A>): Promise<A> {
        return await connection.transaction({
            isolationLevel: 'SERIALIZABLE', logging: () => {
            }
        }, (tx: sequelize.Transaction) => handler(tx));
    },
    connection: connection
};