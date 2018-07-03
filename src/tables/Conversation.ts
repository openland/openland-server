import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';

export interface ConversationAttributes {
    id: number;
    title: string;
}

export interface Conversation extends sequelize.Instance<Partial<ConversationAttributes>>, ConversationAttributes {

}

export const ConversationTable = connection.define<Conversation, Partial<ConversationAttributes>>('conversation', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    title: {
        type: sequelize.STRING, allowNull: false, validate: {
            notEmpty: true
        }
    },
}, { paranoid: true });