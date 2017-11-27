import { connection } from '../connector';
import * as sequelize from 'sequelize'
import { StreetNumberTable, StreetNumber } from './StreetNumber';

export type PermitStatus = "filed" | "issued" | "completed" | "expired" |
    "cancelled" | "disapproved" | "approved" | "issuing" |
    "revoked" | "withdrawn" | "plancheck" | "suspended" |
    "reinstated" | "filing" | "inspecting" | "upheld" |
    "incomplete" | "granted" | "appeal"

export interface PermitAttributes {
    id?: number;
    permitId?: string;
    account?: number;
    permitStatus?: PermitStatus
    permitStatusUpdated?: Date;
    permitCreated?: Date;
    permitIssued?: Date;
    permitCompleted?: Date;
    permitExpired?: Date;
    streetNumbers?: Array<StreetNumber>;
    existingStories?: number;
    proposedStories?: number;
    existingUnits?: number;
    proposedUnits?: number;
    existingAffordableUnits?: number;
    proposedAffordableUnits?: number;
    proposedUse?: string;
    description?: string;
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
    permitStatus: {
        type: sequelize.ENUM(
            'filed', 'issued', 'completed', 'expired',
            'cancelled', 'disapproved', 'approved', 'issuing',
            'revoked', 'withdrawn', 'plancheck', 'suspended',
            'reinstated', 'filing', 'inspecting', 'upheld',
            'incomplete', 'granted'
        ), allowNull: true
    },
    permitStatusUpdated: { type: sequelize.DATEONLY, allowNull: true },
    permitCreated: { type: sequelize.DATEONLY, allowNull: true },
    permitIssued: { type: sequelize.DATEONLY, allowNull: true },
    permitCompleted: { type: sequelize.DATEONLY, allowNull: true },
    permitExpired: { type: sequelize.DATEONLY, allowNull: true },
    existingStories: { type: sequelize.INTEGER, allowNull: true },
    proposedStories: { type: sequelize.INTEGER, allowNull: true },
    existingUnits: { type: sequelize.INTEGER, allowNull: true },
    proposedUnits: { type: sequelize.INTEGER, allowNull: true },
    existingAffordableUnits: { type: sequelize.INTEGER, allowNull: true },
    proposedAffordableUnits: { type: sequelize.INTEGER, allowNull: true },
    proposedUse: { type: sequelize.STRING, allowNull: true },
    description: { type: sequelize.STRING(4096), allowNull: true }
}, { indexes: [{ unique: true, fields: ['permitId', 'account'] }] })

PermitTable.belongsToMany(StreetNumberTable, { through: 'permit_street_numbers', as: 'streetNumbers' })
StreetNumberTable.belongsToMany(PermitTable, { through: 'permit_street_numbers', as: 'permits' })