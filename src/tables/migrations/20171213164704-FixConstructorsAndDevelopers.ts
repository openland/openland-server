import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.sequelize.query('ALTER TABLE "developers" DROP CONSTRAINT developers_account_key;');
    await queryInterface.sequelize.query('ALTER TABLE "constructors" DROP CONSTRAINT constructors_account_key;');
    // await queryInterface.changeColumn('developers', 'account', {
    //     type: sequelize.INTEGER,
    //     references: {
    //         model: 'accounts',
    //         key: 'id',
    //     },
    //     unique: false
    // });
    // await queryInterface.changeColumn('constructors', 'account', {
    //     type: sequelize.INTEGER,
    //     references: {
    //         model: 'accounts',
    //         key: 'id',
    //     },
    //     unique: false
    // });
}

export async function down(queryInterface: QueryInterface, sequelize: DataTypes) {

}