import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { UserTable } from './User';
import { Conversation, ConversationTable } from './Conversation';
import { Organization, OrganizationTable } from './Organization';

export interface ConversationChannelMemberAttributes {
    id: number;
    orgId: number;
    invitedByUser: number;
    invitedByOrg: number;
    conversationId: number;
    role: 'member' | 'creator';
    status: 'invited' | 'member' | 'requested';
    org: Organization;
    conversation: Conversation;
}

export interface ConversationChannelMember extends sequelize.Instance<Partial<ConversationChannelMemberAttributes>>, ConversationChannelMemberAttributes {
    createdAt: Date;
    updatedAt: Date;
}

export const ConversationChannelMembersTable = connection.define<ConversationChannelMember, Partial<ConversationChannelMemberAttributes>>('conversation_channel_member', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    role: { type: sequelize.STRING, allowNull: false, defaultValue: 'member' },
    status: { type: sequelize.STRING, allowNull: true }
});

ConversationChannelMembersTable.belongsTo(OrganizationTable, { as: 'org', foreignKey: { allowNull: false } });
ConversationChannelMembersTable.belongsTo(UserTable, { foreignKey: 'invitedByUser' });
ConversationChannelMembersTable.belongsTo(OrganizationTable, { foreignKey: 'invitedByOrg' });
ConversationChannelMembersTable.belongsTo(ConversationTable, { as: 'conversation', foreignKey: { allowNull: false } });