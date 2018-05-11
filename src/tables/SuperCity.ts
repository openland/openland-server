import { connection } from '../connector';
import * as sequelize from 'sequelize';

export interface SuperCityAttributes {
    id: number;
    key: string;
    name: string;
    enabled: boolean;
    blockSource: string | null;
    blockSourceLayer: string | null;
    parcelSource: string | null;
    parcelSourceLayer: string | null;
}

export interface SuperCity extends sequelize.Instance<Partial<SuperCityAttributes>>, SuperCityAttributes {

}

export const SuperCityTable = connection.define<SuperCity, Partial<SuperCityAttributes>>('super_city', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    key: { type: sequelize.STRING, allowNull: false, unique: true },
    name: { type: sequelize.STRING, allowNull: false },
    enabled: { type: sequelize.STRING, allowNull: false, defaultValue: false },
    blockSource: { type: sequelize.STRING, allowNull: true },
    blockSourceLayer: { type: sequelize.STRING, allowNull: true },
    parcelSource: { type: sequelize.STRING, allowNull: true },
    parcelSourceLayer: { type: sequelize.STRING, allowNull: true },
});