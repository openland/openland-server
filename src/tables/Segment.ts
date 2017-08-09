import { connection } from '../connector';
import * as sequelize from 'sequelize'

export interface SegmentAttributes {
    id?: number;
    name?: string;
    city?: number;
    slug?: string;
    activated?: boolean;
}

export interface Segment extends sequelize.Instance<SegmentAttributes>, SegmentAttributes { }

export const SegmentTable = connection.define<Segment, SegmentAttributes>('segments', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: sequelize.STRING },
    city: {
        type: sequelize.INTEGER, references: {
            model: 'cities',
            key: 'id',
        }
    },
    slug: { type: sequelize.STRING, unique: true },
    activated: { type: sequelize.BOOLEAN, defaultValue: false }
})