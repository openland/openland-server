import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('user_profiles', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        firstName: { type: sequelize.STRING, allowNull: false },
        lastName: { type: sequelize.STRING, allowNull: true },
        picture: { type: sequelize.STRING, allowNull: true },
        userId: { type: sequelize.INTEGER, allowNull: false, references: { model: 'users' }, unique: true },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE },
        deletedAt: { type: sequelize.DATE },
    });
}