import { UpdateReader } from 'openland-server/modules/updateReader';
import { DB } from 'openland-server/tables';

export const tokenExport = () => {
    let reader = new UpdateReader('token_export', 1, DB.UserToken);
    reader.processor(async (data) => {
        console.log('token');
    });
    return reader;
};