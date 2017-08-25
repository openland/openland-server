import { connection } from '../connector';
import * as sequelize from 'sequelize'

export interface FindigsAttributes {
    id?: number;
    account: number;
    intro: string;
    title: string;
}

export interface Findings extends sequelize.Instance<FindigsAttributes>, FindigsAttributes { }

export const FindingsTable = connection.define<Findings, FindigsAttributes>('finding', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    account: {
        type: sequelize.INTEGER,
        references: {
            model: 'accounts',
            key: 'id',
        },
        unique: true
    },
    intro: { type: sequelize.STRING, allowNull: false },
    title: { type: sequelize.STRING, allowNull: false }
})