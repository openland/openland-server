import { connection } from '../connector';
import * as sequelize from 'sequelize'

export interface UserAttributes {
    id?: number;
    authId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    picture?: string;
}

export interface User extends sequelize.Instance<UserAttributes>, UserAttributes { }

export const UserTable = connection.define<User, UserAttributes>('user', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    authId: { type: sequelize.STRING, unique: true },
    firstName: { type: sequelize.STRING, allowNull: false },
    lastName: { type: sequelize.STRING, allowNull: false },
    email: { type: sequelize.STRING, allowNull: false },
    picture: { type: sequelize.STRING, allowNull: false }
})