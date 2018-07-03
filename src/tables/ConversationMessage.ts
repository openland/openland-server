import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { UserTable } from './User';
import { ConversationTable } from './Conversation';

export interface ConversationMessageAttributes {
    id: number;
    message: string;
    userId: number;
    conversationId: number;
}

export interface ConversationMessage extends sequelize.Instance<Partial<ConversationMessageAttributes>>, ConversationMessageAttributes {
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}

export const ConversationMessageTable = connection.define<ConversationMessage, Partial<ConversationMessageAttributes>>('conversation_message', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    message: {
        type: sequelize.STRING, allowNull: false, validate: {
            notEmpty: true
        }
    }
}, { paranoid: true });

ConversationMessageTable.belongsTo(UserTable, { as: 'user', foreignKey: { allowNull: false } });
ConversationMessageTable.belongsTo(ConversationTable, { as: 'conversation', foreignKey: { allowNull: false } });