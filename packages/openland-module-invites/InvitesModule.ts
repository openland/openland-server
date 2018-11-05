import { FDB } from 'openland-module-db/FDB';
import { InviteRepository } from './repositories/InviteRepository';

export class InvitesModule {
    readonly repo = new InviteRepository(FDB);

    start = () => {
        // Nothing to do
    }

    async getInviteLinkKey(uid: number) {
        return this.repo.getInviteLinkKey(uid);
    }
}