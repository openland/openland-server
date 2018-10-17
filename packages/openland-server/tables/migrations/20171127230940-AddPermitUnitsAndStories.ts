import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('permits', 'existingStories', {type: sequelize.INTEGER, allowNull: true});
    await queryInterface.addColumn('permits', 'proposedStories', {type: sequelize.INTEGER, allowNull: true});
    await queryInterface.addColumn('permits', 'existingUnits', {type: sequelize.INTEGER, allowNull: true});
    await queryInterface.addColumn('permits', 'proposedUnits', {type: sequelize.INTEGER, allowNull: true});
    await queryInterface.addColumn('permits', 'existingAffordableUnits', {type: sequelize.INTEGER, allowNull: true});
    await queryInterface.addColumn('permits', 'proposedAffordableUnits', {type: sequelize.INTEGER, allowNull: true});
    await queryInterface.addColumn('permits', 'proposedUse', {type: sequelize.STRING, allowNull: true});
    await queryInterface.addColumn('permits', 'description', {type: sequelize.STRING(4096), allowNull: true});
}