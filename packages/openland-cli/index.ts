// tslint:disable:no-floating-promises
// tslint:disable:no-console
// Register Modules
require('module-alias/register');
import { openDatabase } from './utils/openDatabase';

(async function () {
    let res = await openDatabase();
    for (let ent of res.allEntities) {
        console.log(ent.name);
    }
})();