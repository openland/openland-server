import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';

export interface ConversationBlockedAttributes {
    id: number;
    conversation: number;
    blockedBy: number;
    user: number;
}

export interface ConversationBlocked extends sequelize.Instance<Partial<ConversationBlockedAttributes>>, ConversationBlockedAttributes {

}

export const ConversationBlockedTable = connection.define<ConversationBlocked, Partial<ConversationBlockedAttributes>>('conversation_blocked_users', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    conversation: { type: sequelize.INTEGER, allowNull: true },
    user: { type: sequelize.INTEGER, allowNull: false },
    blockedBy: { type: sequelize.INTEGER, allowNull: false },
}, {
        paranoid: true
    });