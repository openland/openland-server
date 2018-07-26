import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { JsonMap } from '../utils/json';

export interface WallPostAttributes {
    id?: number;
    orgId?: number;
    creatorId?: number;
    type?: 'UPDATE' | 'NEWS' | 'LISTING';
    text?: string;
    extras?: JsonMap;
    isPinned?: boolean;
    lastEditor?: number;
    isDeleted?: boolean;
}

export interface WallPost extends sequelize.Instance<WallPostAttributes>, WallPostAttributes {

}

export const WallPostTable = connection.define<WallPost, WallPostAttributes>('wall_post', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    orgId: { type: sequelize.INTEGER, allowNull: false, references: { model: 'organizations' } },
    creatorId: { type: sequelize.INTEGER, allowNull: false, references: { model: 'users' } },
    type: sequelize.ENUM(['UPDATE', 'NEWS', 'LISTING']),
    createdAt: { type: sequelize.DATE },
    updatedAt: { type: sequelize.DATE },
    text: { type: sequelize.TEXT, allowNull: false, defaultValue: '' },
    extras: {
        type: sequelize.JSON,
        allowNull: false,
        defaultValue: {}
    },
    isPinned: { type: sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    lastEditor: { type: sequelize.INTEGER, allowNull: true, references: { model: 'users' } },
    isDeleted: { type: sequelize.BOOLEAN,  allowNull: false,  defaultValue: false }
}, { });
