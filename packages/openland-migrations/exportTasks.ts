// import { UpdateReader } from 'openland-server/modules/updateReader';
// import { DB } from 'openland-server/tables';
// import { inTx } from 'foundation-orm/inTx';

// export const exportTasks = () => {
//     let reader = new UpdateReader('tasks_export', 8, DB.Task);
//     reader.processor(async (data) => {
//         await inTx(async () => {
//             for (let t of data) {
//                 FDB.UserToken.createOrUpdate(t.tokenSalt!, { uid: t.userId!, lastIp: t.lastIp ? t.lastIp : '' });
//             }
//         });
//     });
//     return reader;
// };