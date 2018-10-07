import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('private_calls', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        callerId: { type: sequelize.INTEGER, references: { model: 'users', key: 'id' }, allowNull: false },
        callerTimeout: { type: sequelize.DATE, allowNull: false },
        calleeId: { type: sequelize.INTEGER, references: { model: 'users', key: 'id' }, allowNull: false },
        calleeTimeout: { type: sequelize.DATE },
        active: { type: sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE }
    });
}