import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';

export interface PhoneAttributes {
    id?: number;
    phone?: string;
    status?: string;
    userId?: number;
}

export interface Phone extends sequelize.Instance<PhoneAttributes>, PhoneAttributes {
}

export const PhoneTable = connection.define<Phone, PhoneAttributes>('phone', {
    id: {type: sequelize.INTEGER, primaryKey: true, autoIncrement: true},
    phone: {type: sequelize.STRING, allowNull: false, unique: true},
    status: {type: sequelize.STRING, allowNull: false},
    userId: {
        type: sequelize.INTEGER,
        references: { model: 'users', key: 'id' },
        allowNull: false
    },
});