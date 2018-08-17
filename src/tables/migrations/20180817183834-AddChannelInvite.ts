import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('channel_invites', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        uuid: { type: sequelize.STRING(256), allowNull: false, unique: true },
        creatorId: { type: sequelize.INTEGER, allowNull: true, references: { model: 'users' } },
        channelId: { type: sequelize.INTEGER, allowNull: true, references: { model: 'conversations' } },
        isOneTime: { type: sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        ttl: { type: sequelize.INTEGER, allowNull: true },
        forEmail: { type: sequelize.STRING, allowNull: true },
        memberRole: { type: sequelize.STRING, allowNull: true },
        memberFirstName: { type: sequelize.STRING, allowNull: true },
        memberLastName: { type: sequelize.STRING, allowNull: true },
        emailText: { type: sequelize.STRING(4096), allowNull: true },
        acceptedById: { type: sequelize.INTEGER, allowNull: true },

        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE }
    });
}