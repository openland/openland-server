import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('user_presences', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        lastSeen: { type: sequelize.DATE, allowNull: false },
        lastSeenTimeout: { type: sequelize.DATE, allowNull: false },
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
    await queryInterface.addIndex('user_presences', ['userId', 'tokenId'], { indicesType: 'UNIQUE' });
}