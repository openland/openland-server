import { connection } from '../connector';
import * as sequelize from 'sequelize';
import { CityTable, City } from './City';

export type StreetSuffixes = 'St' | 'Av' | 'Dr' | 'Bl' | 'Wy' | 'Ln' | 'Hy' | 'Tr' | 'Pl' | 'Ct' |
    'Pk' | 'Al' | 'Cr' | 'Rd' | 'Sq' | 'Pz' | 'Sw' | 'No' | 'Rw' | 'So' | 'Hl' | 'Wk' | 'Lp';

/*
 * St - Street [STR]
 * Av - Avenue [AVE]
 * Dr - Drive
 * Bl - Boulevard [BLV, BLVD]
 * Wy - Way
 * Ln - ???
 * Hy - Highway [HWY]
 * Tr - Terassa [TER]
 * Pl -
 * Ct -
 * Pk - Park
 * Al - Alley [ALY]
 * Cr - Circle [CIR]
 * Rd - 
 * Sq -
 * Pz - Plaza [PLZ]
 * Sw - ??? [STWY]
 * No -
 * Rw - Row (???) [ROW]
 * So - 
 * Hl -
 * Wk - Walk [WALK]
 * Lp - Loop
 */

export interface StreetAttributes {
    id?: number;
    name?: string;
    cityId?: number;
    suffix?: StreetSuffixes | null;
}

export interface Street extends sequelize.Instance<StreetAttributes>, StreetAttributes {
    city?: City;
}

export const StreetTable = connection.define<Street, StreetAttributes>('street', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: sequelize.STRING, allowNull: false },
    suffix: {
        type: sequelize.ENUM(['St', 'Av', 'Dr', 'Bl', 'Wy', 'Ln', 'Hy', 'Tr', 'Pl', 'Ct',
            'Pk', 'Al', 'Cr', 'Rd', 'Sq', 'Pz', 'Sw', 'No', 'Rw', 'So', 'Hl', 'Wk', 'Lp']), allowNull: true
    },
}, {
        indexes: [{
            unique: true, fields: ['cityId', 'name', 'suffix'], where: {
                'suffix': {
                    $ne: null
                }
            }
        }, {
            unique: true, fields: ['cityId', 'name'], where: {
                'suffix': {
                    $eq: null
                }
            }
        }]
    });

StreetTable.belongsTo(CityTable, { as: 'city' });