import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('organizations', 'userId', {
        type: sequelize.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
        }
    });
}