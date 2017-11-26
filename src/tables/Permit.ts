import { connection } from '../connector';
import * as sequelize from 'sequelize'
import { StreetNumberTable, StreetNumber } from './StreetNumber';
export interface PermitAttributes {
    id?: number;
    permitId?: string;
    account?: number;
    permitStatus?: "filed" | "issued" | "completed" | "expired";
    permitCreated?: Date;
    permitIssued?: Date;
    permitCompleted?: Date;
    permitExpired?: Date;
    streetNumbers?: Array<StreetNumber>;
    getStreetNumbers?(): Promise<Array<StreetNumber>>;
    setStreetNumbers?(streets: Array<StreetNumber>): Promise<void>;
    addStreetNumber?(id: number): Promise<StreetNumber>;
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
    permitStatus: { type: sequelize.ENUM('filed', 'issued', 'completed', 'expired'), allowNull: true },
    permitCreated: { type: sequelize.DATEONLY, allowNull: true },
    permitIssued: { type: sequelize.DATEONLY, allowNull: true },
    permitCompleted: { type: sequelize.DATEONLY, allowNull: true },
    permitExpired: { type: sequelize.DATEONLY, allowNull: true },
}, { indexes: [{ unique: true, fields: ['permitId', 'account'] }] })

PermitTable.belongsToMany(StreetNumberTable, { through: 'permit_street_numbers', as: 'streetNumbers' })
StreetNumberTable.belongsToMany(PermitTable, { through: 'permit_street_numbers', as: 'permits' })