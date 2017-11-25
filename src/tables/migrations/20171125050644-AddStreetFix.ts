import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.addColumn('streets', 'createdAt', dataTypes.DATE);
    await queryInterface.addColumn('streets', 'updatedAt', dataTypes.DATE);

    // createdAt: { type: dataTypes.DATE },
    // updatedAt: { type: dataTypes.DATE }
}

export async function down(queryInterface: QueryInterface, dataTypes: DataTypes) {

}