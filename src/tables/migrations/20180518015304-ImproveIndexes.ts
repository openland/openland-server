import { QueryInterface, DataTypes } from 'sequelize';
import { createReaderIndex } from '../../utils/db_utils';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    
    await createReaderIndex(queryInterface, 'lots');
    await createReaderIndex(queryInterface, 'blocks');
    await createReaderIndex(queryInterface, 'permits');
    await createReaderIndex(queryInterface, 'incidents');
    await createReaderIndex(queryInterface, 'opportunities');

    await createReaderIndex(queryInterface, 'folders', true);
}