import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { UserTable } from './User';
import { ConversationTable } from './Conversation';

export interface ConversationUserStateAttributes {
    id: number;
    userId: number;
    conversationId: number;
    unread: number;
    readDate: number;
    active: boolean;
}

export interface ConversationUserState extends sequelize.Instance<Partial<ConversationUserStateAttributes>>, ConversationUserStateAttributes {
    createdAt: Date;
    updatedAt: Date;
}

export const ConversationUserStateTable = connection.define<ConversationUserState, Partial<ConversationUserStateAttributes>>('conversation_user_state', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    unread: { type: sequelize.INTEGER, defaultValue: 0, allowNull: false },
    readDate: { type: sequelize.INTEGER, defaultValue: 0, allowNull: true },
    active: { type: sequelize.BOOLEAN, defaultValue: true, allowNull: false }
});

ConversationUserStateTable.belongsTo(UserTable, { as: 'user', foreignKey: { allowNull: false } });
ConversationUserStateTable.belongsTo(ConversationTable, { as: 'conversation', foreignKey: { allowNull: false } });