import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.removeColumn('permits', 'permitStatus');
    await queryInterface.sequelize.query('DROP TYPE "public"."enum_permits_permitStatus"');
    await queryInterface.addColumn('permits', 'permitStatus', {
        type: dataTypes.ENUM('filed', 'issued', 'completed', 'expired'),
        allowNull: true
    });
}