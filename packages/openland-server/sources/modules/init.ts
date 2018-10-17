import * as fdb from 'foundationdb';
import * as fs from 'fs';

fdb.setAPIVersion(510);

let db: fdb.Database;
if (process.env.FOUNDATION_DB) {
    fs.writeFileSync('foundation.clusterfile', process.env.FOUNDATION_DB);
    db = fdb.openSync('foundation.clusterfile');
} else {
    db = fdb.openSync();
}

export const FDBConnection =
    db.withKeyEncoding(fdb.encoders.tuple)
        .withValueEncoding(fdb.encoders.json);