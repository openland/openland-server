import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { User, UserTable } from './User';
import { ImageRef } from '../repositories/Media';

export interface UserProfileAttributes {
    id: number;
    firstName: string;
    lastName: string | null;
    phone?: string | null;
    about?: string | null;
    website?: string | null;
    location?: string | null;
    email?: string | null;
    picture: ImageRef | null;
    userId?: number | null;
    user?: User | null;
}

export interface UserProfile extends sequelize.Instance<Partial<UserProfileAttributes>>, UserProfileAttributes {

}

export const UserProfileTable = connection.define<UserProfile, Partial<UserProfileAttributes>>('user_profile', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    firstName: { type: sequelize.STRING, allowNull: false },
    lastName: { type: sequelize.STRING, allowNull: true },
    phone: { type: sequelize.STRING, allowNull: true },
    picture: { type: sequelize.JSON, allowNull: true },
    about: { type: sequelize.STRING, allowNull: true },
    website: { type: sequelize.STRING, allowNull: true },
    location: { type: sequelize.STRING, allowNull: true },
    email: { type: sequelize.STRING, allowNull: true },
}, { paranoid: true });

UserTable.hasOne(UserProfileTable, { as: 'userProfile', foreignKey: 'userId' });
UserProfileTable.belongsTo(UserTable, { as: 'user' });