import { staticWorker } from 'openland-module-workers/staticWorker';
import { performMigrations, FMigration } from 'foundation-orm/FMigrator';
import { FDB } from './FDB';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { inTx } from 'foundation-orm/inTx';
import { Modules } from 'openland-modules/Modules';

var migrations: FMigration[] = [];
migrations.push({
    key: '17-fix-primaryorganization',
    migration: async (log) => {
        let user = await FDB.UserProfile.findAll();
        for (let u of user) {
            await inTx(async () => {
                let primaryOrganization: number | null = null;
                let profile = (await FDB.UserProfile.findById(u.id))!;
                let orgs = await Modules.Orgs.findUserOrganizations(u.id);

                if (orgs.length === 0) {
                    // If no active organizations - no primary one
                    primaryOrganization = null;
                } else {

                    // If there are one existing check if it is activated
                    if (profile.primaryOrganization) {
                        let existing = orgs.find((v) => v === profile.primaryOrganization);
                        if (existing) {
                            let o = await FDB.Organization.findById(existing);
                            if (o && o.status === 'activated') {
                                primaryOrganization = o.id;
                            } else {
                                primaryOrganization = null;
                            }
                        } else {
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

export function startMigrationsWorker() {
    if (serverRoleEnabled('workers')) {
        staticWorker({ name: 'foundation-migrator' }, async () => {
            await performMigrations(FDB.connection, migrations);
            return false;
        });
    }
}