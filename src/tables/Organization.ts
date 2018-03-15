import { connection } from '../connector';
import * as sequelize from 'sequelize';

export interface OrganizationAttributes {
    id?: number;
    title?: string;
    status?: 'PENDING' | 'ACTIVATED' | 'SUSPENDED';
}

export interface Organization extends sequelize.Instance<OrganizationAttributes>, OrganizationAttributes {
}

export const OrganizationTable = connection.define<Organization, OrganizationAttributes>('organization', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: sequelize.STRING, allowNull: true },
    status: {
        type: sequelize.ENUM(
            'PENDING',
            'ACTIVATED',
            'SUSPENDED'
        ),
        defaultValue: 'PENDING',
        allowNull: false
    }
});