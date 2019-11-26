import { VostokSession } from './VostokSession';
import { asyncRun } from '../utils';
import { delay } from '../../openland-utils/timer';
import { EMPTY_SESSION_TTL } from './vostokServer';
import { createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';
import { randomKey } from '../../openland-utils/random';

const rootCtx = createNamedContext('vostok');
const log = createLogger('vostok');

export class VostokSessionsManager {
    readonly sessions = new Map<string, VostokSession>();

    constructor() {
        asyncRun(async () => {
            while (true) {
                for (let session of this.sessions.values()) {
                    if (
                        session.state === 'closed' ||
                        (session.noConnectsSince && ((Date.now() - session.noConnectsSince) > EMPTY_SESSION_TTL))
                    ) {
                        log.log(rootCtx, 'drop session', session.sessionId);
                        session.destroy();
                        this.sessions.delete(session.sessionId);
                    }
                }
                await delay(1000);
            }
        });
    }

    add(session: VostokSession) {
        this.sessions.set(session.sessionId, session);
    }

    get(sessionId: string) {
        return this.sessions.get(sessionId);
    }

    newSession() {
        let session = new VostokSession(randomKey());
        this.add(session);
        return session;
    }
}