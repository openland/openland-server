import { DataTypes, Sequelize, Instance } from 'sequelize'

export interface VoteAttributes {
    id?: number;
    slug?: string;
}

export interface Vote extends Instance<VoteAttributes>, VoteAttributes { }

export const VoteTable = function (sequelize: Sequelize, dataTypes: DataTypes) {
    sequelize.define<Vote, VoteAttributes>('vote', {
        id: { type: dataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        slug: { type: dataTypes.STRING }
    }, { indexes: [{ unique: true, fields: ['id', 'slug'] }] })
}