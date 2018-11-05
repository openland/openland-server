import { FDB } from 'openland-module-db/FDB';
import { InviteRepository } from './repositories/InviteRepository';
import { startMigrator } from 'openland-module-invites/Migrator';

export class InvitesModule {
    readonly repo = new InviteRepository(FDB);

    start = () => {
        startMigrator();

    }

    async getInviteLinkKey(uid: number) {
        return this.repo.getInviteLinkKey(uid);
    }
}