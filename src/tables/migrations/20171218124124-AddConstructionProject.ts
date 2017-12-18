import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('construction_projects', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        account: {
            type: sequelize.INTEGER, references: {
                model: 'accounts',
                key: 'id',
            },
            allowNull: false
        },
        projectId: { type: sequelize.STRING, allowNull: false },
        createdAt: sequelize.DATE,
        updatedAt: sequelize.DATE
    })
    await queryInterface.addIndex('construction_projects', ['account', 'projectId'], {
        indicesType: "UNIQUE"
    })
}

export async function down(queryInterface: QueryInterface, sequelize: DataTypes) {

}