import { FConnection } from '../FConnection';
import { randomKey } from 'openland-utils/random';
import { delay } from 'openland-utils/timer';
import { withLogContext } from 'openland-log/withLogContext';
import { createLogger } from 'openland-log/createLogger';
import { FKeyEncoding } from './FKeyEncoding';
import { createEmptyContext, Context } from 'openland-utils/Context';

export class FNodeRegistrator {
    private readonly connection: FConnection;
    private readonly log = createLogger('registrator');
    private nodeId: Promise<number> | null;
    private ctx: Context;

    constructor(connection: FConnection) {
        this.connection = connection;
        this.nodeId = null;

        this.ctx = withLogContext(createEmptyContext(), ['node-registrator-loop']);
    }

    getNodeId() {
        if (!this.nodeId) {
            let seed = randomKey();
            this.nodeId = (async () => {
                while (true) {
                    let candidate = Math.round(Math.random() * 1023);
                    let now = Date.now();
                    this.log.log(this.ctx, 'Check if ' + candidate + ' is available');
                    let res = await this.connection.fdb.doTransaction(async (tn) => {
                        let existing = await tn.get(FKeyEncoding.encodeKey(['__system', '__nodeid', candidate]));
                        if (!existing || ((existing.timeout as number) < now)) {
                            tn.set(FKeyEncoding.encodeKey(['__system', '__nodeid', candidate]), { timeout: now + 60000, seed: seed });
                            return true;
                        } else {
                            return false;
                        }
                    });
                    if (res) {
                        // Start Refresh Loop
                        // tslint:disable:no-floating-promises
                        (async () => {
                            while (true) {
                                let updated = await this.connection.fdb.doTransaction(async (tn) => {
                                    let existing = await tn.get(FKeyEncoding.encodeKey(['__system', '__nodeid', candidate]));
                                    if (existing && existing.seed === seed) {
                                        tn.set(FKeyEncoding.encodeKey(['__system', '__nodeid', candidate]), { timeout: Date.now() + 60000, seed: seed });
                                        return true;
                                    } else {
                                        return false;
                                    }
                                });
                                if (updated) {
                                    await delay(5000);
                                } else {
                                    // Halt NodeJS process
                                    process.abort();
                                }
                            }
                            //
                        })();
                        return candidate;
                    }
                }
            })();
        }
        return this.nodeId;
    }
}