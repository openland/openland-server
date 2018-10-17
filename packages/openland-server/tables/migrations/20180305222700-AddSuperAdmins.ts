import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('super_admins', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        userId: {
            type: sequelize.INTEGER, references: {
                model: 'users',
                key: 'id'
            }
        },
        createdAt: sequelize.DATE,
        updatedAt: sequelize.DATE,
    });
}