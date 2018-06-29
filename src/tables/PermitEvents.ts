import { connection } from '../connector';
import * as sequelize from 'sequelize';
import { PermitTable, Permit } from './Permit';

export type PermitEventType = 'status_changed' | 'field_changed';

export interface PermitEventAttributes {
    id?: number;
    account?: number;

    eventDate?: string;
    eventType?: PermitEventType;
    eventContent?: any;

    permitId?: number;
    permit?: Permit;
}

export interface PermitEvent extends sequelize.Instance<PermitEventAttributes>, PermitEventAttributes {
}

export const PermitEventsTable = connection.define<PermitEvent, PermitEventAttributes>('permit_events', {
    id: {type: sequelize.INTEGER, primaryKey: true, autoIncrement: true},
    account: {
        type: sequelize.INTEGER, references: {
            model: 'accounts',
            key: 'id',
        }
        , allowNull: false
    },
    eventDate: {type: sequelize.DATEONLY, allowNull: false},
    eventType: {
        type: sequelize.ENUM('status_changed', 'field_changed'), allowNull: false
    },
    eventContent: {
        type: sequelize.JSONB, allowNull: false,
    },
});

PermitEventsTable.belongsTo(PermitTable, {as: 'permit'});
PermitTable.hasMany(PermitEventsTable, {as: 'events'});