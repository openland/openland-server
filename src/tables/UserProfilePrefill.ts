import { connection } from '../connector';
import * as sequelize from 'sequelize';
import { User, UserTable } from './User';

export interface UserProfilePrefillAttributes {
    id: number;
    firstName: string | null;
    lastName: string | null;
    picture: string | null;
    userId?: number | null;
    user?: User | null;
}

export interface UserProfilePrefill extends sequelize.Instance<Partial<UserProfilePrefillAttributes>>, UserProfilePrefillAttributes {

}

export const UserProfilePrefillTable = connection.define<UserProfilePrefill, Partial<UserProfilePrefillAttributes>>('user_profile_prefill', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    firstName: { type: sequelize.STRING, allowNull: true },
    lastName: { type: sequelize.STRING, allowNull: true },
    picture: { type: sequelize.STRING, allowNull: true }
});

UserProfilePrefillTable.belongsTo(UserTable, { as: 'user' });