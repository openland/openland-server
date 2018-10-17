import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('phones', {
        id: {type: sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        phone: {type: sequelize.STRING, allowNull: false, unique: true},
        status: {type: sequelize.STRING, allowNull: false},
        userId: {
            type: sequelize.INTEGER,
            references: { model: 'users', key: 'id' },
            allowNull: false
        },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE },
    });
}