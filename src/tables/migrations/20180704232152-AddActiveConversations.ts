import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('conversation_user_states', 'active', { type: sequelize.BOOLEAN, defaultValue: true, allowNull: false });
    await queryInterface.createTable('conversation_user_globals', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        userId: {
            type: sequelize.INTEGER, allowNull: false, references: {
                model: 'users'
            }
        },
        unread: { type: sequelize.INTEGER, defaultValue: 0, allowNull: false },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE }
    });
}