import { FConnection } from './FConnection';
import { FEntityFactory } from './FEntityFactory';
import { createEmptyContext } from 'openland-utils/Context';
import { FKeyEncoding } from './utils/FKeyEncoding';

export class FDiagnostics {
    private connection: FConnection;

    constructor(connection: FConnection) {
        this.connection = connection;
    }

    async runEntityDiagnostics(src: FEntityFactory<any>) {
        let ctx = createEmptyContext();

        // Load all keys from namespace
        let res = await src.namespace.range(ctx, this.connection, []);
        res = res.filter((v) => !FKeyEncoding.decodeKey(v.key).find((k) => k === '__indexes'));
        let nskeys = res.map((v) => FKeyEncoding.encodeKeyToString(FKeyEncoding.decodeKey(v.key).splice(2) as any));

        // Load all keys from directory
        let res2 = await src.directory.range2(ctx, []);
        let dirkeys = res2.map((v) => FKeyEncoding.encodeKeyToString(FKeyEncoding.decodeKey(v.key) as any));

        // Check equality
        if (nskeys.length !== dirkeys.length) {
            throw Error('[' + src.name + '] Number of entities mismatched');
        }
        for (let nsk of nskeys) {
            let found = false;
            for (let dsk of dirkeys) {
                if (dsk === nsk) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                throw Error('[' + src.name + '] Namespace key not found in directory: ' + JSON.stringify(FKeyEncoding.decodeFromString(nsk)));
            }
        }
        for (let dsk of dirkeys) {
            let found = false;
            for (let nsk of nskeys) {
                if (dsk === nsk) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                throw Error('[' + src.name + '] Directory key not found in namespace: ' + JSON.stringify(FKeyEncoding.decodeFromString(dsk)));
            }
        }
    }
}