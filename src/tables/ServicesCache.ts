import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { JsonMap } from '../utils/json';

export interface ServicesCacheAttributes {
    id?: number;
    service?: string;
    key?: string;
    content?: JsonMap;
}

export interface ServicesCache extends sequelize.Instance<ServicesCacheAttributes>, ServicesCacheAttributes {

}

export const ServicesCacheTable = connection.define<ServicesCache, ServicesCacheAttributes>('services_cache', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    service: { type: sequelize.STRING, allowNull: false },
    key: { type: sequelize.STRING(4096), allowNull: false },
    content: { type: sequelize.JSON, allowNull: false },
}, { indexes: [{ unique: true, fields: ['service', 'key'] }] });