import { connection } from '../connector';
import * as sequelize from 'sequelize'

export const Dashboard = connection.define('dashboard', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: sequelize.STRING },
    description: { type: sequelize.STRING }
})