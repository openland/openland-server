import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { UserTable } from './User';

export interface ConversationUserGlobalNotificationsAttributes {
    id: number;
    userId: number;
    lastPushNotification: Date | null;
    lastEmailSeq: number;
    lastPushSeq: number;
}

export interface ConversationUserGlobalNotifications extends sequelize.Instance<Partial<ConversationUserGlobalNotificationsAttributes>>, ConversationUserGlobalNotificationsAttributes {
    createdAt: Date;
    updatedAt: Date;
}

export const ConversationsUserGlobalNotificationsTable = connection.define<ConversationUserGlobalNotifications, Partial<ConversationUserGlobalNotificationsAttributes>>('conversation_user_global_notification', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    lastPushNotification: { type: sequelize.DATE, allowNull: true },
    lastEmailSeq: { type: sequelize.INTEGER, defaultValue: 0, allowNull: false },
    lastPushSeq: { type: sequelize.INTEGER, defaultValue: 0, allowNull: false },
});

ConversationsUserGlobalNotificationsTable.belongsTo(UserTable, { as: 'user', foreignKey: { allowNull: false } });