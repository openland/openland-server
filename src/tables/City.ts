import { connection } from '../connector';
import * as sequelize from 'sequelize'

export const City = connection.define('city', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: sequelize.STRING },
})