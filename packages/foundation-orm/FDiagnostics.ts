import { FConnection } from './FConnection';
import { FEntityFactory } from './FEntityFactory';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { EmptyContext } from '@openland/context';

export class FDiagnostics {

    constructor(connection: FConnection) {
        //        
    }

    async runEntityDiagnostics(src: FEntityFactory<any>) {
        let diag = '';
        let ctx = EmptyContext;

        // Load all keys from namespace
        let res = await src.namespace.keySpace.range(ctx, []);
        res = res.filter((v) => !v.key.find((k) => k === '__indexes'));
        let nskeys = res.map((v) => FKeyEncoding.encodeKeyToString(v.key.splice(2) as any));

        // Load all keys from directory
        let res2 = await src.directory.range(ctx, []);
        let dirkeys = res2.map((v) => FKeyEncoding.encodeKeyToString(v.key));

        // Check equality
        if (nskeys.length !== dirkeys.length) {
            diag += '\n';
            diag += '[' + src.name + '] Number of entities mismatched: ' + nskeys.length + ' vs ' + dirkeys.length;
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
                diag += '\n';
                diag += '[' + src.name + '] Namespace key not found in directory: ' + JSON.stringify(FKeyEncoding.decodeFromString(nsk));
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
                diag += '\n';
                diag += '[' + src.name + '] Directory key not found in namespace: ' + JSON.stringify(FKeyEncoding.decodeFromString(dsk));
            }
        }
        return diag;
    }
}