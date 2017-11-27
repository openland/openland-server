import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.sequelize.query("ALTER TYPE \"public\".\"enum_permits_permitStatus\" ADD VALUE 'appeal'")
}

export async function down(queryInterface: QueryInterface, dataTypes: DataTypes) {
    
}