import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.changeColumn('user_profiles', 'phone', { type: sequelize.STRING, allowNull: true });   
    
    await queryInterface.addColumn('organizations', 'website', { type: sequelize.STRING, allowNull: true });       
    await queryInterface.addColumn('organizations', 'logo', { type: sequelize.JSON, allowNull: true });
    await queryInterface.addColumn('organizations', 'extras', { type: sequelize.JSON, allowNull: true });
         
}