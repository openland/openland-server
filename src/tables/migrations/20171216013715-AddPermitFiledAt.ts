import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('permits', 'permitStarted', { type: sequelize.DATEONLY, allowNull: true })
    await queryInterface.addColumn('permits', 'permitFiled', { type: sequelize.DATEONLY, allowNull: true })
    await queryInterface.addColumn('permits', 'permitExpires', { type: sequelize.DATEONLY, allowNull: true })
}

export async function down(queryInterface: QueryInterface, sequelize: DataTypes) {

}