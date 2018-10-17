import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { User, UserTable } from './User';
import { ImageRef } from '../repositories/Media';
import { UserExtras } from '../repositories/UserExtras';

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
    extras?: UserExtras;
    primaryOrganization?: number;
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
    extras: {
        type: sequelize.JSON,
        allowNull: false,
        defaultValue: {}
    },
    primaryOrganization: {
        type: sequelize.INTEGER,
        allowNull: true,
        references: {
            model: 'organizations'
        }
    }
}, { paranoid: true });

UserProfileTable.belongsTo(UserTable, { as: 'user' });