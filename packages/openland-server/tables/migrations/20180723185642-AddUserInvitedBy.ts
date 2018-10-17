import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('users', 'invitedBy', {
        type: sequelize.INTEGER, 
        allowNull: true, 
        references: { model: 'users' }
    });
}