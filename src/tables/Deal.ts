import { connection } from '../connector';
import * as sequelize from 'sequelize';
import { Organization, OrganizationTable } from './Organization';
import { LotTable, Lot } from './Lot';

export interface DealAttributes {
    id?: number;
    title?: string;

    status?: string | null;
    statusDescription?: string | null;
    statusDate?: string | null;

    address?: string | null;
    location?: string | null;

    price?: number | null;
    area?: number | null;
    company?: string | null;
    attorney?: string | null;
    referee?: string | null;

    lotShape?: string | null;
    lotSize?: string | null;

    taxBill?: number | null;

    organizationId?: number | null;
    organization?: Organization | null;

    parcelId?: number | null;
    parcel?: Lot | null;
}

export interface Deal extends sequelize.Instance<DealAttributes>, DealAttributes {
    getOrganization(options?: any): Promise<Organization | null>;
    getParcel(options?: any): Promise<Lot | null>;
}

export const DealTable = connection.define<Deal, DealAttributes>('deal', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: sequelize.STRING, allowNull: false },

    status: { type: sequelize.STRING, allowNull: true },
    statusDescription: { type: sequelize.STRING, allowNull: true },
    statusDate: { type: sequelize.DATE, allowNull: true },

    price: { type: sequelize.INTEGER, allowNull: true },
    area: { type: sequelize.INTEGER, allowNull: true },
    company: { type: sequelize.STRING, allowNull: true },
    attorney: { type: sequelize.STRING, allowNull: true },
    referee: { type: sequelize.STRING, allowNull: true },

    lotShape: { type: sequelize.STRING, allowNull: true },
    lotSize: { type: sequelize.STRING, allowNull: true },

    taxBill: { type: sequelize.INTEGER, allowNull: true },

    address: { type: sequelize.STRING, allowNull: true },
    location: { type: sequelize.STRING, allowNull: true },
});

DealTable.belongsTo(OrganizationTable, { as: 'organization', foreignKey: { allowNull: false } });
DealTable.belongsTo(LotTable, { as: 'parcel', foreignKey: { allowNull: true } });