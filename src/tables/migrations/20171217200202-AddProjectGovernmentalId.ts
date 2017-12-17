import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn("building_projects", "govId", { type: sequelize.STRING, allowNull: true });
    await queryInterface.addIndex("building_projects", ['govId', 'account'], {
        indicesType: "UNIQUE"
    })
}

export async function down(queryInterface: QueryInterface, sequelize: DataTypes) {

}