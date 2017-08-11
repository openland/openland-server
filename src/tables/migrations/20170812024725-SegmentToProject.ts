import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    queryInterface.renameTable('segments', 'projects')
}

export async function down(queryInterface: QueryInterface, dataTypes: DataTypes) {

}