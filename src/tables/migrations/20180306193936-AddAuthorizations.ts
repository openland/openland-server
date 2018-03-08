import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('user_tokens', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        tokenSalt: { type: sequelize.STRING, allowNull: false, unique: true },
        userId: {
            type: sequelize.INTEGER,
            references: {
                model: 'users',
                key: 'id'
            },
            allowNull: false
        },
        createdAt: sequelize.DATE,
        updatedAt: sequelize.DATE
    });
}