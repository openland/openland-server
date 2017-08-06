import { connection } from '../connector';
import * as sequelize from 'sequelize'

export interface DashboardAttributes {
    id?: number;
    title?: string;
    kind?: string;
    description?: string;
}

export interface Dashboard extends sequelize.Instance<DashboardAttributes>, DashboardAttributes { }

export const DashboardTable = connection.define<Dashboard, DashboardAttributes>('dashboard', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: sequelize.STRING },
    kind: { type: sequelize.STRING, allowNull: true },
    description: { type: sequelize.STRING },
})