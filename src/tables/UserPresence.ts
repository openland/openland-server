import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { UserTable } from './User';
import { UserTokenTable } from './UserToken';

export interface UserPresenceAttributes {
    id: number;
    userId: number;
    tokenId: number;
    lastSeen: Date;
    lastSeenTimeout: Date;
    platform: string|null;
}

export interface UserPresence extends sequelize.Instance<Partial<UserPresenceAttributes>>, UserPresenceAttributes {

}

export const UserPresenceTable = connection.define<UserPresence, Partial<UserPresenceAttributes>>('user_presence', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    lastSeen: { type: sequelize.DATE, allowNull: false },
    lastSeenTimeout: { type: sequelize.DATE, allowNull: false },
    platform: { type: sequelize.STRING, allowNull: true }
});

UserPresenceTable.belongsTo(UserTable, { as: 'user' });
UserPresenceTable.belongsTo(UserTokenTable, { as: 'token' });