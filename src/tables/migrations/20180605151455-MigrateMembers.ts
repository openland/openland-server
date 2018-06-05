import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.sequelize.query(`INSERT INTO "organization_members"("userId", "orgId","isOwner") (SELECT "id" as "userId", "organizationId" as "orgId", true as "isOwner" FROM "users" WHERE "users"."organizationId" IS NOT NULL) ON CONFLICT DO NOTHING;`);
}