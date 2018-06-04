import { connection } from '../connector';
import * as sequelize from 'sequelize';
import { Organization, OrganizationTable } from './Organization';

export interface UserAttributes {
    id?: number;
    authId?: string;
    email?: string;
    organizationId?: number | null;
    organization?: Organization | null;
}

export interface User extends sequelize.Instance<UserAttributes>, UserAttributes {
    getOrganization(options?: any): Promise<Organization | null>;
}

export const UserTable = connection.define<User, UserAttributes>('user', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    authId: { type: sequelize.STRING, unique: true },
    email: { type: sequelize.STRING, allowNull: false },
});

UserTable.belongsTo(OrganizationTable, { as: 'organization' });