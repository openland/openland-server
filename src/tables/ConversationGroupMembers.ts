import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { UserTable } from './User';
import { ConversationTable } from './Conversation';

export interface ConversationGroupMemberAttributes {
    id: number;
    userId: number;
    invitedById: number;
    conversationId: number;
}

export interface ConversationGroupMember extends sequelize.Instance<Partial<ConversationGroupMemberAttributes>>, ConversationGroupMemberAttributes {
    createdAt: Date;
    updatedAt: Date;
}

export const ConversationGroupMembersTable = connection.define<ConversationGroupMember, Partial<ConversationGroupMemberAttributes>>('conversation_group_member', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
});

ConversationGroupMembersTable.belongsTo(UserTable, { as: 'user', foreignKey: { allowNull: false } });
ConversationGroupMembersTable.belongsTo(UserTable, { as: 'invitedBy', foreignKey: { allowNull: false } });
ConversationGroupMembersTable.belongsTo(ConversationTable, { as: 'conversation', foreignKey: { allowNull: false } });