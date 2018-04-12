import { connection } from '../connector';
import * as sequelize from 'sequelize';

export interface LotUserDataAttributes {
    id?: number;
    lotId?: number;
    organizationId?: number;
    notes?: string | null;
}

export interface LotUserData extends sequelize.Instance<LotUserDataAttributes>, LotUserDataAttributes {

}

export const LotUserDataTable = connection.define<LotUserData, LotUserDataAttributes>('lot_user_datas', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    lotId: {
        type: sequelize.INTEGER,
        references: { model: 'lots', key: 'id' },
        allowNull: false
    },
    organizationId: {
        type: sequelize.INTEGER,
        references: { model: 'organizations', key: 'id' },
        allowNull: false
    },
    notes: {
        type: sequelize.STRING(4098),
        allowNull: true
    },
}, { indexes: [{ unique: true, fields: ['lotId', 'organizationId'] }] });