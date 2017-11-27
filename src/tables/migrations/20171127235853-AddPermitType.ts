import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('permits', 'permitType', {
        type: sequelize.ENUM(
            "new_construction", "additions_alterations_repare",
            "otc_additions", "wall_or_painted_sign", "sign_errect", "demolitions",
            "grade_quarry_fill_excavate"
        ), allowNull: true
    })
    await queryInterface.addColumn('permits', 'permitTypeWood', { type: sequelize.BOOLEAN, allowNull: true });
}

export async function down(queryInterface: QueryInterface, sequelize: DataTypes) {

}