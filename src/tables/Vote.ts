import { connection } from '../connector';
import * as sequelize from 'sequelize'

export interface VoteAttributes {
    id?: number;
    slug?: string;
}

export interface Vote extends sequelize.Instance<VoteAttributes>, VoteAttributes { }

export const VoteTable = connection.define<Vote, VoteAttributes>('vote', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    slug: { type: sequelize.STRING }
}, { indexes: [{ unique: true, fields: ['id', 'slug'] }] })