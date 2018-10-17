import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn(
        'wall_posts',
        'isPinned',
        { type: sequelize.BOOLEAN, allowNull: false, defaultValue: false }
    );
    await queryInterface.addColumn(
        'wall_posts',
        'lastEditor',
        { type: sequelize.INTEGER, allowNull: true, references: { model: 'users' } }
    );
}