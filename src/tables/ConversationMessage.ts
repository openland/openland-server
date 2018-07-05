import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { UserTable } from './User';
import { ConversationTable } from './Conversation';
import { JsonMap } from '../utils/json';

export interface ConversationMessageAttributes {
    id: number;
    message?: string | null;
    fileId?: string | null;
    fileMetadata?: JsonMap | null;
    userId: number;
    conversationId: number;
    repeatToken: string | null;
}

export interface ConversationMessage extends sequelize.Instance<Partial<ConversationMessageAttributes>>, ConversationMessageAttributes {
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}

export const ConversationMessageTable = connection.define<ConversationMessage, Partial<ConversationMessageAttributes>>('conversation_message', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    message: {
        type: sequelize.STRING(4096), allowNull: true, validate: {
            notEmpty: true
        }
    },
    fileId: { type: sequelize.STRING, allowNull: true },
    fileMetadata: { type: sequelize.JSON, allowNull: true },
    repeatToken: { type: sequelize.STRING, allowNull: true, unique: true },
}, {
        paranoid: true,
        validate: {
            validateContent() {
                if (!this.message && !this.fileId) {
                    throw Error('Content is not provided');
                }
                if (!!this.fileId && !this.fileMetadata) {
                    throw Error('File metadata is not provided');
                }
            }
        }
    });

ConversationMessageTable.belongsTo(UserTable, { as: 'user', foreignKey: { allowNull: false } });
ConversationMessageTable.belongsTo(ConversationTable, { as: 'conversation', foreignKey: { allowNull: false } });