import { QueryInterface, DataTypes } from 'sequelize';
import { connection } from 'openland-server/modules/sequelizeConnector';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('user_tokens', 'uuid', { type: sequelize.STRING, unique: true, defaultValue: connection.literal('uuid_generate_v4()'), allowNull: false });
}