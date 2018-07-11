import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { UserTable } from './User';

export interface ConversationUserGlobalAttributes {
    id: number;
    userId: number;
    unread: number;
    seq: number;
    hasUnnoticedUnread: boolean;
    lastEmailNotification: Date | null;
}

export interface ConversationUserGlobal extends sequelize.Instance<Partial<ConversationUserGlobalAttributes>>, ConversationUserGlobalAttributes {
    createdAt: Date;
    updatedAt: Date;
}

export const ConversationsUserGlobalTable = connection.define<ConversationUserGlobal, Partial<ConversationUserGlobalAttributes>>('conversation_user_global', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    unread: { type: sequelize.INTEGER, defaultValue: 0, allowNull: false },
    seq: { type: sequelize.INTEGER, defaultValue: 0, allowNull: false },
    hasUnnoticedUnread: { type: sequelize.BOOLEAN, defaultValue: false, allowNull: false },
    lastEmailNotification: { type: sequelize.DATE, allowNull: true }
});

ConversationsUserGlobalTable.belongsTo(UserTable, { as: 'user', foreignKey: { allowNull: false } });