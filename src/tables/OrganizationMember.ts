import { connection } from '../connector';
import * as sequelize from 'sequelize';

export interface OrganizationMemberAttributes {
    id: number;
    userId: number;
    orgId: number;
    isOwner: boolean;
}

export interface OrganizationMember extends sequelize.Instance<Partial<OrganizationMemberAttributes>>, OrganizationMemberAttributes {
}

export const OrganizationMemberTable = connection.define<OrganizationMember, Partial<OrganizationMemberAttributes>>('organization_member', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: sequelize.INTEGER, allowNull: false, references: { model: 'user' } },
    orgId: { type: sequelize.INTEGER, allowNull: false, references: { model: 'organization' } },
    isOwner: { type: sequelize.BOOLEAN, allowNull: false },
}, { indexes: [{ fields: ['userId', 'orgId'], index: 'UNIQUE' }] });