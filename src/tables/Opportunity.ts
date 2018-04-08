import { connection } from '../connector';
import * as sequelize from 'sequelize';
import { Organization, OrganizationTable } from './Organization';
import { Lot } from '.';
import { LotTable } from './Lot';

export interface OpportunityAttributes {
    id?: number;
    state?: 'INCOMING' | 'APPROVED_INITIAL' | 'APPROVED_ZONING' | 'APPROVED' | 'REJECTED' | 'SNOOZED';

    organizationId?: number | null;
    organization?: Organization | null;

    lotId?: number | null;
    lot?: Lot | null;
}

export interface Opportunity extends sequelize.Instance<OpportunityAttributes>, OpportunityAttributes {
    getOrganization(options?: any): Promise<Organization | null>;
    getLot(options?: any): Promise<Lot | null>;
}

export const OpportunityTable = connection.define<Opportunity, OpportunityAttributes>('opportunity', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    state: { type: sequelize.STRING, allowNull: false, defaultValue: 'INCOMING' }
}, { indexes: [{ fields: ['organizationId', 'lotId'], index: 'UNIQUE' }] });

OpportunityTable.belongsTo(OrganizationTable, { as: 'organization', foreignKey: { allowNull: false } });
OpportunityTable.belongsTo(LotTable, { as: 'lot', foreignKey: { allowNull: false } });
