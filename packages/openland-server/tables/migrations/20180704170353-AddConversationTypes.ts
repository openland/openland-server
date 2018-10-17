import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('conversations', 'type', { type: sequelize.STRING, defaultValue: 'anonymous', allowNull: false });
    await queryInterface.addColumn('conversations', 'member1Id', {
        type: sequelize.INTEGER, references: {
            model: 'users'
        }
    });
    await queryInterface.addColumn('conversations', 'member2Id', {
        type: sequelize.INTEGER, references: {
            model: 'users'
        }
    });
    await queryInterface.addColumn('conversations', 'organization1Id', {
        type: sequelize.INTEGER, references: {
            model: 'organizations'
        }
    });
    await queryInterface.addColumn('conversations', 'organization2Id', {
        type: sequelize.INTEGER, references: {
            model: 'organizations'
        }
    });
}