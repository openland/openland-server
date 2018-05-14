import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('cities', 'tag', { type: sequelize.STRING, allowNull: true, unique: true });
}