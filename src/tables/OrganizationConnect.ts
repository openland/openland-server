import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';

export interface OrganizationConnectAttributes {
    id?: number;
    initiatorOrgId?: number;
    targetOrgId?: number;
    followStatus: 'FOLLOWING' | 'NOT_FOLLOWING';
}

export interface OrganizationConnect extends sequelize.Instance<OrganizationConnectAttributes>, OrganizationConnectAttributes {
}

export const OrganizationConnectTable = connection.define<OrganizationConnect, OrganizationConnectAttributes>('organization_connects', {
    id: {
        type: sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    initiatorOrgId: {
        type: sequelize.INTEGER,
        allowNull: false,
        references: { model: 'organization' }
    },
    targetOrgId: {
        type: sequelize.INTEGER,
        allowNull: false,
        references: { model: 'organization' }
    },
    followStatus: {
        type: sequelize.STRING,
        defaultValue: 'NOT_FOLLOWING',
        allowNull: false
    }
});