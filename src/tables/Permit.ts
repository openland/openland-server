import { connection } from '../connector';
import * as sequelize from 'sequelize'

export interface PermitAttributes {
    id?: number;
    permitId?: string;
    account?: number;
    address?: string;
    permitStatus?: "filled" | "issued" | "completed" | "expired";
    permitCreated?: Date;
    permitIssued?: Date;
    permitCompleted?: Date;
    permitExpired?: Date;
}

export interface Permit extends sequelize.Instance<PermitAttributes>, PermitAttributes { }

export const PermitTable = connection.define<Permit, PermitAttributes>('permits', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    permitId: { type: sequelize.STRING },
    account: {
        type: sequelize.INTEGER, references: {
            model: 'accounts',
            key: 'id',
        }
    },
    address: { type: sequelize.STRING, allowNull: true },
    permitStatus: { type: sequelize.ENUM('filled', 'issued', 'completed', 'expired'), allowNull: true },
    permitCreated: { type: sequelize.DATEONLY, allowNull: true },
    permitIssued: { type: sequelize.DATEONLY, allowNull: true },
    permitCompleted: { type: sequelize.DATEONLY, allowNull: true },
    permitExpired: { type: sequelize.DATEONLY, allowNull: true },
}, { indexes: [{ unique: true, fields: ['permitId', 'account'] }] })