import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {

    //
    // Tables
    //

    await queryInterface.createTable('blocks', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        blockId: {
            type: sequelize.STRING,
            allowNull: false
        },
        cityId: {
            type: sequelize.INTEGER,
            references: {
                model: 'cities',
                key: 'id'
            },
            allowNull: false
        },
        geometry: {
            type: sequelize.JSON,
            allowNull: true
        },
        createdAt: sequelize.DATE,
        updatedAt: sequelize.DATE
    });
    await queryInterface.createTable('lots', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        lotId: {
            type: sequelize.STRING,
            allowNull: false
        },
        blockId: {
            type: sequelize.INTEGER,
            references: {
                model: 'blocks',
                key: 'id'
            },
            allowNull: false
        },
        geometry: {
            type: sequelize.JSON,
            allowNull: true
        },
        createdAt: sequelize.DATE,
        updatedAt: sequelize.DATE
    });

    //
    // Indexes
    //

    await queryInterface.addIndex('blocks', ['cityId', 'blockId'], {
        indicesType: 'UNIQUE'
    });
    await queryInterface.addIndex('lots', ['blockId', 'lotId'], {
        indicesType: 'UNIQUE'
    });
    await queryInterface.addIndex('blocks', ['updatedAt']);
    await queryInterface.addIndex('lots', ['updatedAt']);
}