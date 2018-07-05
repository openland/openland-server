import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { UserTable } from './User';
import { JsonMap } from '../utils/json';

export interface ConversationUserEventsAttributes {
    id: number;
    userId: number;
    eventType: string;
    event: JsonMap;
    seq: number;
}

export interface ConversationUserEvents extends sequelize.Instance<Partial<ConversationUserEventsAttributes>>, ConversationUserEventsAttributes {
    createdAt: Date;
    updatedAt: Date;
}

export const ConversationUserEventsTable = connection.define<ConversationUserEvents, Partial<ConversationUserEventsAttributes>>('conversation_user_event', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    eventType: { type: sequelize.STRING, allowNull: false },
    event: { type: sequelize.JSON, allowNull: false },
    seq: { type: sequelize.INTEGER, allowNull: false }
});

ConversationUserEventsTable.belongsTo(UserTable, { as: 'user', foreignKey: { allowNull: false } });