import { connection } from '../connector';
import * as sequelize from 'sequelize'

export const User = connection.define('user', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    authId: { type: sequelize.STRING, unique: true }
})