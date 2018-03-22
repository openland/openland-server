import { connection } from '../connector';
import * as sequelize from 'sequelize';

export { User } from './User';
export { Account } from './Account';
export { AccountMember } from './Account';
export { DataSet } from './DataSet';
export { Street } from './Street';
export { StreetNumber } from './StreetNumber';
export { BuildingProject } from './BuildingProject';
export { AirTable } from './AirTable';
export { PermitEvent } from './PermitEvents';
export { Developer } from './Developer';
export { State } from './State';
export { County } from './County';
export { City } from './City';
export { ReaderState } from './ReaderState';
export { Lock } from './Lock';
export { Block } from './Block';
export { Lot } from './Lot';
export { Incident } from './Incidents';

import { UserTable } from './User';
import { AccountTable } from './Account';
import { AccountMemberTable } from './Account';
import { DataSetTable } from './DataSet';
import { PermitTable } from './Permit';
import { ReaderStateTable } from './ReaderState';
import { StreetTable } from './Street';
import { StreetNumberTable } from './StreetNumber';
import { BuildingProjectTable } from './BuildingProject';
import { AirTableTable } from './AirTable';
import { PermitEventsTable } from './PermitEvents';
import { DeveloperTable } from './Developer';
import { StateTable } from './State';
import { CountyTable } from './County';
import { CityTable } from './City';
import { LockTable } from './Lock';
import { BlockTable } from './Block';
import { LotTable } from './Lot';
import { IncidentTable } from './Incidents';
import { ParcelIDTable } from './ParcelID';
import { SuperAdminTable } from './SuperAdmin';
import { UserTokenTable } from './UserTokens';
import { OrganizationTable } from './Organization';
import { DealTable } from './Deal';
import { FeatureFlagTable } from './FeatureFlag';

export const DB = {
    User: UserTable,
    Account: AccountTable,
    AccountMember: AccountMemberTable,
    DataSet: DataSetTable,
    Permit: PermitTable,
    Street: StreetTable,
    StreetNumber: StreetNumberTable,
    BuidlingProject: BuildingProjectTable,
    AirTable: AirTableTable,
    PermitEvents: PermitEventsTable,
    Developer: DeveloperTable,
    State: StateTable,
    County: CountyTable,
    City: CityTable,
    ReaderState: ReaderStateTable,
    Lock: LockTable,
    Block: BlockTable,
    Lot: LotTable,
    Incident: IncidentTable,
    ParcelID: ParcelIDTable,
    SuperAdmin: SuperAdminTable,
    UserToken: UserTokenTable,
    Organization: OrganizationTable,
    Deal: DealTable,
    FeatureFlag: FeatureFlagTable,

    tx: async function tx<A>(handler: (tx: sequelize.Transaction) => PromiseLike<A>): Promise<A> {
        return await connection.transaction({ isolationLevel: 'SERIALIZABLE' }, (tx2: sequelize.Transaction) => handler(tx2));
    },
    txSilent: async function tx<A>(handler: (tx: sequelize.Transaction) => PromiseLike<A>): Promise<A> {
        return await connection.transaction({
            isolationLevel: 'SERIALIZABLE', logging: () => {
                //
            }
        }, (tx2: sequelize.Transaction) => handler(tx2));
    },
    connection: connection
};