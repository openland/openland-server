import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';

export interface OrganizationInviteAttributes {
    id: number;
    uuid: string;
    orgId: number;
    creatorId: number;
    isOneTime: boolean;
    memberFirstName: string;
    memberLastName: string;
    ttl: number;
    forEmail: string;
    memberRole: string;
    emailText: string;
    type: 'for_organization' | 'for_member';
}

export interface OrganizationInvite extends sequelize.Instance<Partial<OrganizationInviteAttributes>>, OrganizationInviteAttributes {

}

export const OrganizationInviteTable = connection.define<OrganizationInvite, Partial<OrganizationInviteAttributes>>('organization_invites', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    uuid: { type: sequelize.STRING(256), allowNull: false, unique: true },
    orgId: { type: sequelize.INTEGER, allowNull: false, references: { model: 'organization' } },
    creatorId: { type: sequelize.INTEGER, allowNull: true, references: { model: 'users' } },
    isOneTime: { type: sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    ttl: { type: sequelize.INTEGER, allowNull: true },
    forEmail: { type: sequelize.STRING, allowNull: true },
    memberRole: { type: sequelize.STRING, allowNull: true },
    memberFirstName: { type: sequelize.STRING, allowNull: true},
    memberLastName: { type: sequelize.STRING,  allowNull: true },
    emailText: { type: sequelize.STRING(4096),  allowNull: true },
    type: {
        type: sequelize.ENUM('for_organization', 'for_member'),
        allowNull: false,
        defaultValue: 'for_member'
    }
});