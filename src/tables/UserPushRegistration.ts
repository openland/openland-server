import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { UserTable } from './User';
import { UserTokenTable } from './UserToken';

export interface UserPushRegistrationAttributes {
    id: number;
    userId: number;
    tokenId: number;
    pushEndpoint: string;
    pushType: 'web-push' | 'safari' | 'ios' | 'android';
}

export interface UserPushRegistration extends sequelize.Instance<Partial<UserPushRegistrationAttributes>>, UserPushRegistrationAttributes {

}

export const UserPushRegistrationTable = connection.define<UserPushRegistration, Partial<UserPushRegistrationAttributes>>('user_push_registration', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    pushEndpoint: { type: sequelize.STRING(4096), allowNull: false, unique: true },
    pushType: { type: sequelize.STRING, allowNull: false, defaultValue: 'web-push' }
});

UserPushRegistrationTable.belongsTo(UserTable, { as: 'user' });
UserPushRegistrationTable.belongsTo(UserTokenTable, { as: 'token' });