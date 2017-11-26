import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.removeColumn('permits', 'address')
    await queryInterface.addColumn('permits', 'streetNumber', {
        type: dataTypes.INTEGER, references: {
            model: 'streetnumbers',
            key: 'id',
        }
    })
}

export async function down(queryInterface: QueryInterface, dataTypes: DataTypes) {

}