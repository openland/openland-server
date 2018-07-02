import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { User, UserTable } from './User';

export interface OrganizationMemberAttributes {
    id: number;
    userId: number;
    orgId: number;
    isOwner: boolean;
    invitedBy?: number;
    user: User;
}

export interface OrganizationMember extends sequelize.Instance<Partial<OrganizationMemberAttributes>>, OrganizationMemberAttributes {
}

export const OrganizationMemberTable = connection.define<OrganizationMember, Partial<OrganizationMemberAttributes>>('organization_member', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    orgId: { type: sequelize.INTEGER, allowNull: false, references: { model: 'organization' } },
    isOwner: { type: sequelize.BOOLEAN, allowNull: false },
    invitedBy: { type: sequelize.INTEGER, allowNull: true, references: { model: 'users' } }
}, { indexes: [{ fields: ['userId', 'orgId'], index: 'UNIQUE' }] });

OrganizationMemberTable.belongsTo(UserTable, { as: 'user' });