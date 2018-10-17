import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('lot_user_datas', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        lotId: {
            type: sequelize.INTEGER,
            references: { model: 'lots', key: 'id' },
            allowNull: false
        },
        organizationId: {
            type: sequelize.INTEGER,
            references: { model: 'organizations', key: 'id' },
            allowNull: false
        },
        notes: {
            type: sequelize.STRING(4098),
            allowNull: true
        },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE }
    });
    await queryInterface.addIndex('lot_user_datas', ['lotId', 'organizationId'], { indicesType: 'UNIQUE' });
}