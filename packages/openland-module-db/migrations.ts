import { staticWorker } from 'openland-module-workers/staticWorker';
import { performMigrations, FMigration } from 'foundation-orm/FMigrator';
import { FDB } from './FDB';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { inTx } from 'foundation-orm/inTx';
import { Modules } from 'openland-modules/Modules';

var migrations: FMigration[] = [];
migrations.push({
    key: '21-create-notification-bot',
    migration: async (log) => {
        await Modules.Users.createSystemBot('openbot', 'openbot', {
            uuid: 'db12b7df-6005-42d9-87d6-46f15dd5b880',
            crop: null
        });
    }
});
migrations.push({
    key: '19-fix-profile',
    migration: async (log) => {
        let user = await FDB.UserProfile.findAllKeys();
        for (let u of user) {
            await inTx(async () => {
                let profile = await FDB.UserProfile.findById(u[u.length - 1]);
                profile!.markDirty();
                await profile!.flush();
            });
        }
    }
});

migrations.push({
    key: '20-fix-primaryorganization',
    migration: async (log) => {
        let user = await FDB.UserProfile.findAll();
        for (let u of user) {
            log.log('Fixing primary organization for user ' + u.id);
            await inTx(async () => {
                let primaryOrganization: number | null = null;
                let profile = (await FDB.UserProfile.findById(u.id))!;
                let orgs = await Modules.Orgs.findUserOrganizations(u.id);

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
                            let o = await FDB.Organization.findById(existing);
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
                            let o = await FDB.Organization.findById(oid);
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
        let k = await FDB.Organization.findAll();
        for (let o of k) {
            await Modules.Orgs.markForUndexing(o.id);
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