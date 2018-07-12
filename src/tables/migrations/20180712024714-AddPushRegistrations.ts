import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('user_push_registrations', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        pushEndpoint: { type: sequelize.STRING, allowNull: false, unique: true },
        userId: {
            type: sequelize.INTEGER, allowNull: false, references: {
                model: 'users'
            }
        },
        tokenId: {
            type: sequelize.INTEGER, allowNull: false, references: {
                model: 'user_tokens'
            }
        },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE }
    });
}