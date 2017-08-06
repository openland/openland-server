import { connection } from '../connector';
import * as sequelize from 'sequelize';

export enum Dimension {
    Percent = 'percent',
    Number = 'number'
}

export interface CounterAttributes {
    id?: number;
    slug?: string;
    dimension?: Dimension;
}

export interface Counter extends sequelize.Instance<CounterAttributes>, CounterAttributes { }

export interface CounterValueAttributes {
    id?: number;
    counter?: number;
    value?: number;
    date?: Date;
}

export interface CounterValue extends sequelize.Instance<CounterValueAttributes>, CounterValueAttributes { }

export const CounterTable = connection.define<Counter, CounterAttributes>('counter', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    slug: { type: sequelize.STRING },
    dimension: { type: sequelize.ENUM({ values: ['percent', 'number'] }) },
}, { indexes: [{ unique: true, fields: ['id', 'slug'] }] });


export const CounterValueTable = connection.define<CounterValue, CounterValueAttributes>('counter_value', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    counter: {
        type: sequelize.INTEGER, references: {
            model: 'counters',
            key: 'id',
        }
    },
    value: { type: sequelize.INTEGER },
    date: { type: sequelize.DATE }
});