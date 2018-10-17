import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('reader_state', {
        id: {type: sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        key: {type: sequelize.STRING, allowNull: false, unique: true},
        currentOffset: {type: sequelize.DATE, allowNull: true},
        createdAt: sequelize.DATE,
        updatedAt: sequelize.DATE
    });
}