import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addIndex('permits', ['permitCreated', 'id'])
}

export async function down(queryInterface: QueryInterface, sequelize: DataTypes) {

}