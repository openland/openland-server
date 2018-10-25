import { updateReader } from 'openland-module-workers/updateReader';
import { FDB } from 'openland-module-db/FDB';
import { createLogger } from 'openland-log/createLogger';

const log = createLogger('indexing');

export function userProfileIndexer() {
    updateReader('profile_indexer', 1, FDB.UserProfile.createByUpdatedAtStream(50), async (items) => {
        for (let u of items) {
            log.log('Received user ' + u.id);
        }
    });
}