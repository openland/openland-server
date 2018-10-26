import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { ConversationTable } from './Conversation';
import { JsonMap } from '../utils/json';

export interface ConversationEventAttributes {
    id: number;
    eventType: string;
    event: JsonMap;
    conversationId: number;
    seq: number;
}

export interface ConversationEvent extends sequelize.Instance<Partial<ConversationEventAttributes>>, ConversationEventAttributes {
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}

export const ConversationEventTable = connection.define<ConversationEvent, Partial<ConversationEventAttributes>>('conversation_event', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    eventType: { type: sequelize.STRING, allowNull: false },
    event: { type: sequelize.JSON, allowNull: false },
    seq: { type: sequelize.INTEGER, allowNull: false }
}, { paranoid: true });

ConversationEventTable.belongsTo(ConversationTable, { as: 'conversation', foreignKey: { allowNull: false } });