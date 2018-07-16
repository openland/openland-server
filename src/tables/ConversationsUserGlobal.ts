import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { UserTable } from './User';

export interface ConversationUserGlobalAttributes {
    id: number;
    userId: number;
    unread: number;
    seq: number;
    readSeq: number | null;
    hasUnnoticedUnread: boolean;
    lastEmailNotification: Date | null;
    lastPushNotification: Date | null;
    lastEmailSeq: number;
    lastPushSeq: number;
}

export interface ConversationUserGlobal extends sequelize.Instance<Partial<ConversationUserGlobalAttributes>>, ConversationUserGlobalAttributes {
    createdAt: Date;
    updatedAt: Date;
}

export const ConversationsUserGlobalTable = connection.define<ConversationUserGlobal, Partial<ConversationUserGlobalAttributes>>('conversation_user_global', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    unread: { type: sequelize.INTEGER, defaultValue: 0, allowNull: false },
    seq: { type: sequelize.INTEGER, defaultValue: 0, allowNull: false },
    readSeq: { type: sequelize.INTEGER, allowNull: true },
    hasUnnoticedUnread: { type: sequelize.BOOLEAN, defaultValue: false, allowNull: false },
    lastEmailNotification: { type: sequelize.DATE, allowNull: true },
    lastPushNotification: { type: sequelize.DATE, allowNull: true },
    lastEmailSeq: { type: sequelize.INTEGER, defaultValue: 0, allowNull: false },
    lastPushSeq: { type: sequelize.INTEGER, defaultValue: 0, allowNull: false },
});

ConversationsUserGlobalTable.belongsTo(UserTable, { as: 'user', foreignKey: { allowNull: false } });