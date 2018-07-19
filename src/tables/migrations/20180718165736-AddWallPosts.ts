import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('wall_posts', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        orgId: { type: sequelize.INTEGER, allowNull: false, references: { model: 'organizations' } },
        creatorId: { type: sequelize.INTEGER, allowNull: false, references: { model: 'users' } },
        type: sequelize.ENUM(['UPDATE', 'NEWS', 'LISTING']),
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE },
        text: { type: sequelize.TEXT, allowNull: false, defaultValue: '' },
        extras: {
            type: sequelize.JSON,
            allowNull: false,
            defaultValue: {}
        }
    });
}