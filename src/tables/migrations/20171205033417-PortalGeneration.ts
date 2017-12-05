import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('accounts', 'generation', { type: sequelize.INTEGER, allowNull: false, defaultValue: 2 });
}

export async function down(queryInterface: QueryInterface, sequelize: DataTypes) {

}