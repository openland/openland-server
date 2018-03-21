import { connection } from '../connector';
import * as sequelize from 'sequelize';
import { Geometry } from '../modules/geometry';
import { Block, BlockTable } from './Block';
import { JsonMap } from '../utils/json';
import { CityTable } from './City';
import { StreetNumberTable, StreetNumber } from './StreetNumber';
import { UserTable, User } from './User';

export interface LotAttributes {
    id?: number;
    cityId?: number;

    lotId?: string;
    primaryParcelId?: number;

    blockId?: number | null;
    geometry?: Geometry | null;
    extras?: JsonMap | null;
    metadata?: JsonMap;

    retired?: boolean;
}

export interface Lot extends sequelize.Instance<LotAttributes>, LotAttributes {
    block?: Block;
    streetNumbers?: Array<StreetNumber>;
    likes?: Array<User>;
    getStreetNumbers(options?: any): Promise<Array<StreetNumber>>;
    setStreetNumbers(numbers: Array<number>, options?: any): Promise<void>;

    getLikes(options?: any): Promise<Array<User>>;
    setLikes(likes: Array<number>, options?: any): Promise<void>;
    addLike(like: number): Promise<void>;
    removeLike(like: number): Promise<void>;
}

export const LotTable = connection.define<Lot, LotAttributes>('lot', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    lotId: {
        type: sequelize.STRING,
        allowNull: false
    },
    geometry: {
        type: sequelize.JSON,
        allowNull: true
    },
    extras: {
        type: sequelize.JSON,
        allowNull: true
    },
    metadata: {
        type: sequelize.JSON,
        allowNull: false,
        defaultValue: {}
    },
    retired: {
        type: sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
}, { indexes: [{ unique: true, fields: ['blockId', 'lotId'] }, { unique: true, fields: ['cityId', 'lotId'] }] });

LotTable.belongsTo(BlockTable, { as: 'block', foreignKey: { allowNull: true } });
LotTable.belongsTo(CityTable, { as: 'city' });
LotTable.belongsTo(LotTable, { as: 'primaryParcel' });

LotTable.belongsToMany(StreetNumberTable, { through: 'lot_street_numbers', as: 'streetNumbers' });

// Likes

LotTable.belongsToMany(UserTable, { through: 'parcel_likes', as: 'likes' });