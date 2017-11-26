import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.sequelize.query("ALTER TYPE \"public\".\"enum_permits_permitStatus\" ADD VALUE 'cancelled'")
    await queryInterface.sequelize.query("ALTER TYPE \"public\".\"enum_permits_permitStatus\" ADD VALUE 'disapproved'")
    await queryInterface.sequelize.query("ALTER TYPE \"public\".\"enum_permits_permitStatus\" ADD VALUE 'approved'")
    await queryInterface.sequelize.query("ALTER TYPE \"public\".\"enum_permits_permitStatus\" ADD VALUE 'issuing'")
    await queryInterface.sequelize.query("ALTER TYPE \"public\".\"enum_permits_permitStatus\" ADD VALUE 'revoked'")
    await queryInterface.sequelize.query("ALTER TYPE \"public\".\"enum_permits_permitStatus\" ADD VALUE 'withdrawn'")
    await queryInterface.sequelize.query("ALTER TYPE \"public\".\"enum_permits_permitStatus\" ADD VALUE 'plancheck'")
    await queryInterface.sequelize.query("ALTER TYPE \"public\".\"enum_permits_permitStatus\" ADD VALUE 'suspended'")
    await queryInterface.sequelize.query("ALTER TYPE \"public\".\"enum_permits_permitStatus\" ADD VALUE 'reinstated'")
    await queryInterface.sequelize.query("ALTER TYPE \"public\".\"enum_permits_permitStatus\" ADD VALUE 'filing'")
    await queryInterface.sequelize.query("ALTER TYPE \"public\".\"enum_permits_permitStatus\" ADD VALUE 'inspecting'")
    await queryInterface.sequelize.query("ALTER TYPE \"public\".\"enum_permits_permitStatus\" ADD VALUE 'upheld'")
    await queryInterface.sequelize.query("ALTER TYPE \"public\".\"enum_permits_permitStatus\" ADD VALUE 'incomplete'")
    await queryInterface.sequelize.query("ALTER TYPE \"public\".\"enum_permits_permitStatus\" ADD VALUE 'granted'")
}

export async function down(queryInterface: QueryInterface, dataTypes: DataTypes) {
    
}