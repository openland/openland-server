import { staticWorker } from 'openland-module-workers/staticWorker';
import { performMigrations, FMigration } from 'foundation-orm/FMigrator';
import { FDB } from './FDB';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { inTx } from 'foundation-orm/inTx';
import { Modules } from 'openland-modules/Modules';
import { createEmptyContext } from 'openland-utils/Context';

var migrations: FMigration[] = [];
migrations.push({
    key: '21-create-notification-bot',
    migration: async (log) => {
        await Modules.Users.createSystemBot(createEmptyContext(), 'openbot', 'openbot', {
            uuid: 'db12b7df-6005-42d9-87d6-46f15dd5b880',
            crop: null
        });
    }
});
migrations.push({
    key: '19-fix-profile',
    migration: async (log) => {
        let ctx = createEmptyContext();
        let user = await FDB.UserProfile.findAllKeys(ctx);
        for (let u of user) {
            await inTx(async () => {
                let profile = await FDB.UserProfile.findById(ctx, u[u.length - 1]);
                profile!.markDirty();
                await profile!.flush();
            });
        }
    }
});

migrations.push({
    key: '20-fix-primaryorganization',
    migration: async (log) => {
        let ctx = createEmptyContext();
        let user = await FDB.UserProfile.findAll(ctx);
        for (let u of user) {
            log.log('Fixing primary organization for user ' + u.id);
            await inTx(async () => {
                let primaryOrganization: number | null = null;
                let profile = (await FDB.UserProfile.findById(ctx, u.id))!;
                let orgs = await Modules.Orgs.findUserOrganizations(ctx, u.id);

                if (orgs.length === 0) {
                    log.log('No organizations for user ' + u.id);
                    // If no active organizations - no primary one
                    primaryOrganization = null;
                } else {

                    // If there are one existing check if it is activated
                    if (profile.primaryOrganization) {
                        log.log('Checking existing for user ' + u.id + ', ' + profile.primaryOrganization);
                        let existing = orgs.find((v) => v === profile.primaryOrganization);
                        if (existing) {
                            log.log('found existing ' + existing);
                            let o = await FDB.Organization.findById(ctx, existing);
                            if (o && o.status === 'activated') {
                                log.log('apply existing ' + existing);
                                primaryOrganization = o.id;
                            } else {
                                if (!o) {
                                    log.log('organization not found ' + existing);
                                } else {
                                    log.log('organization not activated ' + existing);
                                }
                                primaryOrganization = null;
                            }
                        } else {
                            log.log('organization not found2 ' + existing);
                            primaryOrganization = null;
                        }
                    }

                    // If not present - try to find activated one
                    if (!primaryOrganization) {
                        for (let oid of orgs) {
                            let o = await FDB.Organization.findById(ctx, oid);
                            if (o && o.status === 'activated') {
                                primaryOrganization = oid;
                                break;
                            } else {
                                if (!o) {
                                    log.log('organization not found2 ' + oid);
                                } else {
                                    log.log('organization not activated ' + o!.id);
                                }
                            }
                        }
                    }
                }

                if (profile.primaryOrganization !== primaryOrganization) {
                    log.log('Update primary organization for user ' + profile.id + '. Was: ' + profile.primaryOrganization + ', new: ' + primaryOrganization);
                    profile.primaryOrganization = primaryOrganization;
                }
            });
        }
    }
});

migrations.push({
    key: '21-initial-index',
    migration: async (log) => {
        let ctx = createEmptyContext();
        let k = await FDB.Organization.findAll(ctx);
        for (let o of k) {
            await Modules.Orgs.markForUndexing(ctx, o.id);
        }
    }
});

migrations.push({
    key: '22-enforce-dialog-update',
    migration: async (log) => {
        let ctx = createEmptyContext();
        await inTx(async () => {
            let k = await FDB.UserDialog.findAll(ctx);
            for (let o of k) {
                if (o.date) {
                    o.markDirty();
                    await o.flush();
                }
            }
        });
    }
});

migrations.push({
    key: '23-fix-index',
    migration: async (log) => {
        let ctx = createEmptyContext();
        let k = await FDB.UserDialog.findAllKeys(ctx);
        for (let o of k) {
            await inTx(async () => {
                let u = await FDB.UserDialog.findById(ctx, o[o.length - 2], o[o.length - 1]);
                if (u) {
                    u.markDirty();
                    await u.flush();
                }
            });
        }
    }
});

export function startMigrationsWorker() {
    if (serverRoleEnabled('workers')) {
        staticWorker({ name: 'foundation-migrator' }, async () => {
            await performMigrations(FDB.connection, migrations);
            return false;
        });
    }
}