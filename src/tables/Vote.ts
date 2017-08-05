import { connection } from '../connector';
import * as sequelize from 'sequelize'

export const Vote = connection.define('vote', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    slug: { type: sequelize.STRING }
}, { indexes: [{ unique: true, fields: ['id', 'slug'] }] })