import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.sequelize.query("TRUNCATE \"permit_events\" CASCADE")
    await queryInterface.addColumn("permit_events", "eventDate", { type: sequelize.DATEONLY, allowNull: false })
}

export async function down(queryInterface: QueryInterface, sequelize: DataTypes) {

}