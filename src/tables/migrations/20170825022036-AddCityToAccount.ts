import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.addColumn('accounts',
        'city', {type: dataTypes.STRING, allowNull: true}
    );
}