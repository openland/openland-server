import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';

export interface OrganizationInviteAttributes {
    id: number;
    uuid: string;
    orgId: number;
    creatorId: number;
    isOneTime: boolean;
    userName: string;
    ttl: number;
    forEmail: string;
    memberRole: string;
}

export interface OrganizationInvite extends sequelize.Instance<Partial<OrganizationInviteAttributes>>, OrganizationInviteAttributes {
}

export const OrganizationInviteTable = connection.define<OrganizationInvite, Partial<OrganizationInviteAttributes>>('organization_invites', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    uuid: { type: sequelize.STRING(256), allowNull: false, unique: true },
    orgId: { type: sequelize.INTEGER, allowNull: false, references: { model: 'organization' } },
    creatorId: { type: sequelize.INTEGER, allowNull: true, references: { model: 'users' } },
    isOneTime: { type: sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    userName: { type: sequelize.STRING, allowNull: true },
    ttl: { type: sequelize.INTEGER, allowNull: true },
    forEmail: { type: sequelize.STRING, allowNull: true },
    memberRole: { type: sequelize.STRING, allowNull: true },
});