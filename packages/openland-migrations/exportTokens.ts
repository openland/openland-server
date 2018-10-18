import { UpdateReader } from 'openland-server/modules/updateReader';
import { DB } from 'openland-server/tables';
import { inTx } from 'foundation-orm/inTx';
import { FDB } from 'openland-server/sources/FDB';

export const tokenExport = () => {
    let reader = new UpdateReader('token_export', 8, DB.UserToken);
    reader.processor(async (data) => {
        await inTx(async () => {
            for (let t of data) {
                FDB.UserToken.createOrUpdate(t.tokenSalt!, { uid: t.userId!, lastIp: t.lastIp ? t.lastIp : '' });
            }
        });
    });
    return reader;
};