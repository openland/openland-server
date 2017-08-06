import { connection } from '../connector';
import * as sequelize from 'sequelize'

//
// Sector
//

export interface SectorAttributes {
    id?: number;
    name?: string;
}

export interface Sector extends sequelize.Instance<SectorAttributes>, SectorAttributes { }

export const SectorTable = connection.define<Sector, SectorAttributes>('sector', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: sequelize.STRING },
})

//
// Sector Activation
//

export interface SectorActivationAttributes {
    sectorId?: number;
    cityId?: number;
}

export interface SectorActivation extends sequelize.Instance<SectorActivationAttributes>, SectorActivationAttributes { }

export const SectorActivationTable = connection.define<SectorActivation, SectorActivationAttributes>('sector_activation', {
    sectorId: {
        type: sequelize.INTEGER, references: {
            model: 'sectors',
            key: 'id',
        }
    },
    cityId: {
        type: sequelize.INTEGER, references: {
            model: 'cities',
            key: 'id',
        }
    }
}, { indexes: [{ unique: true, fields: ['sectorId', 'cityId'] }] })