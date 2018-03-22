import { connection } from '../connector';
import * as sequelize from 'sequelize';
import { OrganizationTable } from './Organization';

export interface FeatureFlagAttributes {
    id?: number | null;
    key?: string | null;
    title?: string | null;
}

export interface FeatureFlag extends sequelize.Instance<FeatureFlagAttributes>, FeatureFlagAttributes {
}

export const FeatureFlagTable = connection.define<FeatureFlag, FeatureFlagAttributes>('feature_flag', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    key: {
        type: sequelize.STRING, allowNull: false, unique: true, validate: {
            is: /^[a-z\-]+$/i
        }
    },
    title: {
        type: sequelize.STRING, allowNull: false
    }
});

OrganizationTable.belongsToMany(FeatureFlagTable, { through: 'organization_features', as: 'featureFlags' });
FeatureFlagTable.belongsToMany(OrganizationTable, { through: 'organization_features', as: 'organizations' });