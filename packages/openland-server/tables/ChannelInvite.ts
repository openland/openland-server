import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';

export interface ChannelInviteAttributes {
    id: number;
    uuid: string;
    channelId: number;
    creatorId: number;
    isOneTime: boolean;
    memberFirstName: string;
    memberLastName: string;
    ttl: number;
    forEmail: string;
    memberRole: string;
    emailText: string;
    acceptedById: number;
}

export interface ChannelInvite extends sequelize.Instance<Partial<ChannelInviteAttributes>>, ChannelInviteAttributes {

}

export const ChannelInviteTable = connection.define<ChannelInvite, Partial<ChannelInviteAttributes>>('channel_invites', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    uuid: { type: sequelize.STRING(256), allowNull: false, unique: true },
    creatorId: { type: sequelize.INTEGER, allowNull: true, references: { model: 'users' } },
    channelId: { type: sequelize.INTEGER, allowNull: true, references: { model: 'conversations' } },
    isOneTime: { type: sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    ttl: { type: sequelize.INTEGER, allowNull: true },
    forEmail: { type: sequelize.STRING, allowNull: true },
    memberRole: { type: sequelize.STRING, allowNull: true },
    memberFirstName: { type: sequelize.STRING, allowNull: true },
    memberLastName: { type: sequelize.STRING, allowNull: true },
    emailText: { type: sequelize.STRING(4096), allowNull: true },
    acceptedById: { type: sequelize.INTEGER, allowNull: true },
});