import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('short_names', {
        id: {type: sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        name: {type: sequelize.STRING, allowNull: false, unique: true},
        type: {type: sequelize.STRING, allowNull: false},
        ownerId: {type: sequelize.INTEGER, allowNull: false},
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE }
    });
}