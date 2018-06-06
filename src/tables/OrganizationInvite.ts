import { connection } from '../connector';
import * as sequelize from 'sequelize';

export interface OrganizationInviteAttributes {
    id: number;
    uuid: string;
    orgId: number;
}

export interface OrganizationInvite extends sequelize.Instance<Partial<OrganizationInviteAttributes>>, OrganizationInviteAttributes {
}

export const OrganizationInviteTable = connection.define<OrganizationInviteAttributes, Partial<OrganizationInviteAttributes>>('organization_invites', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    uuid: { type: sequelize.STRING(256), allowNull: false, unique: true },
    orgId: { type: sequelize.INTEGER, allowNull: false, references: { model: 'organization' } },
});