import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.sequelize.query('CREATE INDEX permits_search_index ON "permits" ("account", "permitCreated" DESC NULLS LAST, "id")');
}