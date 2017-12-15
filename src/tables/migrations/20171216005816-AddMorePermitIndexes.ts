import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addIndex('permits', ['account', 'permitCreated', 'id'])
}

export async function down(queryInterface: QueryInterface, sequelize: DataTypes) {

}