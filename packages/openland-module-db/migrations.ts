import { staticWorker } from 'openland-module-workers/staticWorker';
import { performMigrations, FMigration } from 'foundation-orm/FMigrator';
import { FDB } from './FDB';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { inTx } from 'foundation-orm/inTx';
import { Modules } from 'openland-modules/Modules';
import { batch } from 'openland-utils/batch';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { randomKey } from '../openland-utils/random';
import { FEntityFactory } from '../foundation-orm/FEntityFactory';
import { FEntity } from '../foundation-orm/FEntity';
import { Context } from '../openland-utils/Context';
import { SLog } from '../openland-log/SLog';

var migrations: FMigration[] = [];
migrations.push({
    key: '21-create-notification-bot',
    migration: async (root, log) => {
        await Modules.Users.createSystemBot(root, 'openbot', 'openbot', {
            uuid: 'db12b7df-6005-42d9-87d6-46f15dd5b880',
            crop: null
        });
    }
});
migrations.push({
    key: '19-fix-profile',
    migration: async (root, log) => {
        let user = await FDB.UserProfile.findAllKeys(root);
        for (let u of user) {
            await inTx(root, async (ctx) => {
                let profile = await FDB.UserProfile.findById(ctx, u[u.length - 1]);
                profile!.markDirty();
                await profile!.flush();
            });
        }
    }
});

migrations.push({
    key: '20-fix-primaryorganization',
    migration: async (root, log) => {
        let user = await FDB.UserProfile.findAll(root);
        for (let u of user) {
            log.log(root, 'Fixing primary organization for user ' + u.id);
            await inTx(root, async (ctx) => {
                let primaryOrganization: number | null = null;
                let profile = (await FDB.UserProfile.findById(ctx, u.id))!;
                let orgs = await Modules.Orgs.findUserOrganizations(ctx, u.id);

                if (orgs.length === 0) {
                    log.log(ctx, 'No organizations for user ' + u.id);
                    // If no active organizations - no primary one
                    primaryOrganization = null;
                } else {

                    // If there are one existing check if it is activated
                    if (profile.primaryOrganization) {
                        log.log(ctx, 'Checking existing for user ' + u.id + ', ' + profile.primaryOrganization);
                        let existing = orgs.find((v) => v === profile.primaryOrganization);
                        if (existing) {
                            log.log(ctx, 'found existing ' + existing);
                            let o = await FDB.Organization.findById(ctx, existing);
                            if (o && o.status === 'activated') {
                                log.log(ctx, 'apply existing ' + existing);
                                primaryOrganization = o.id;
                            } else {
                                if (!o) {
                                    log.log(ctx, 'organization not found ' + existing);
                                } else {
                                    log.log(ctx, 'organization not activated ' + existing);
                                }
                                primaryOrganization = null;
                            }
                        } else {
                            log.log(ctx, 'organization not found2 ' + existing);
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
                                    log.log(ctx, 'organization not found2 ' + oid);
                                } else {
                                    log.log(ctx, 'organization not activated ' + o!.id);
                                }
                            }
                        }
                    }
                }

                if (profile.primaryOrganization !== primaryOrganization) {
                    log.log(ctx, 'Update primary organization for user ' + profile.id + '. Was: ' + profile.primaryOrganization + ', new: ' + primaryOrganization);
                    profile.primaryOrganization = primaryOrganization;
                }
            });
        }
    }
});

migrations.push({
    key: '21-initial-index',
    migration: async (root, log) => {
        let k = await FDB.Organization.findAll(root);
        for (let o of k) {
            await Modules.Orgs.markForUndexing(root, o.id);
        }
    }
});

migrations.push({
    key: '22-enforce-dialog-update',
    migration: async (root, log) => {
        await inTx(root, async (ctx) => {
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
    migration: async (root, log) => {
        let k = await FDB.UserDialog.findAllKeys(root);
        for (let o of k) {
            await inTx(root, async (ctx) => {
                let u = await FDB.UserDialog.findById(ctx, o[o.length - 2], o[o.length - 1]);
                if (u) {
                    u.markDirty();
                    await u.flush();
                }
            });
        }
    }
});

migrations.push({
    key: '24-fix-messages-index',
    migration: async (root, log) => {
        log.debug(root, 'fetching keys');
        let allKeys = await FDB.Message.findAllKeys(root);
        log.debug(root, 'fetched ' + allKeys.length + ' keys');
        let keyBatches = batch(allKeys, 100);
        log.debug(root, keyBatches.length + 'batches');
        let count = 0;
        for (let kb of keyBatches) {
            await inTx(root, async (ctx) => {
                for (let a of kb) {
                    let k = FKeyEncoding.decodeKey(a);
                    k.splice(0, 2);
                    let itm = await (FDB as any)[FDB.Message.name].findByRawId(ctx, k);
                    itm.markDirty();
                }
            });
            log.debug(root, 'batch ' + ++count + '/' + keyBatches.length + ' ✅');
        }
        log.debug(root, '24-fix-messages-index ✅');
    }
});

migrations.push({
    key: '25-reindex-invites',
    migration: async (root, log) => {
        let allKeys = await FDB.ChannelInvitation.findAllKeys(root);
        let keyBatches = batch(allKeys, 100);
        for (let kb of keyBatches) {
            await inTx(root, async (ctx) => {
                for (let a of kb) {
                    let k = FKeyEncoding.decodeKey(a);
                    k.splice(0, 2);
                    let itm = await (FDB as any)[FDB.ChannelInvitation.name].findByRawId(ctx, k);
                    itm.markDirty();
                }
            });
        }
        log.debug(root, '24-fix-messages-index ✅');
    }
});

migrations.push({
    key: '26-reindex-invites',
    migration: async (root, log) => {
        let allKeys = await FDB.ChannelInvitation.findAllKeys(root);
        let keyBatches = batch(allKeys, 100);
        for (let kb of keyBatches) {
            await inTx(root, async (ctx) => {
                for (let a of kb) {
                    let k = FKeyEncoding.decodeKey(a);
                    k.splice(0, 2);
                    let itm = await (FDB as any)[FDB.ChannelInvitation.name].findByRawId(ctx, k);
                    itm.markDirty();
                }
            });
        }
        log.debug(root, '24-fix-messages-index ✅');
    }
});

migrations.push({
    key: '28-reindex-users',
    migration: async (root, log) => {
        let allKeys = await FDB.User.findAllKeys(root);
        let keyBatches = batch(allKeys, 100);
        for (let kb of keyBatches) {
            await inTx(root, async (ctx) => {
                for (let a of kb) {
                    let k = FKeyEncoding.decodeKey(a);
                    k.splice(0, 2);
                    let u = (await FDB.User.findById(ctx, k[0] as number));
                    if (!u) {
                        log.warn(ctx, 'no user found! ' + JSON.stringify(k));
                    } else {
                        u.markDirty();
                    }
                }
            });
        }
    }
});

migrations.push({
    key: '29-fix-apple-account',
    migration: async (root, log) => {
        await inTx(root, async (ctx) => {
            let u = (await FDB.User.findFromAuthId(ctx, 'email|appstore@apple.com'))!;
            if (u) {
                u.email = 'appstore@apple.com';
            }
        });
    }
});

migrations.push({
    key: '30-delete-accounts-without-emails',
    migration: async (root, log) => {
        await inTx(root, async (ctx) => {
            let users = await FDB.User.findAll(ctx);
            for (let u of users) {
                if (u.email === '') {
                    u.status = 'deleted';
                    log.log(ctx, 'Delete user #' + u.id);
                }
            }
        });
    }
});

migrations.push({
    key: '30-delete-duplicated',
    migration: async (root, log) => {
        await inTx(root, async (ctx) => {
            let users = await FDB.User.findAll(ctx);
            let emails = new Set<string>();
            for (let u of users) {
                if (u.status !== 'deleted') {
                    emails.add(u.email);
                }
            }
            for (let e of emails) {
                let us = users.filter((v) => v.status !== 'deleted' && v.email === e);
                if (us.length > 1) {
                    let hasActivated = !!us.find((v) => v.status === 'activated');
                    if (hasActivated) {
                        for (let u of us) {
                            if (u.status !== 'activated') {
                                u.status = 'deleted';
                                log.log(ctx, 'Delete user #' + u.id);
                            }
                        }
                    }
                }
            }
        });
    }
});

migrations.push({
    key: '31-delete-duplicated-pending',
    migration: async (root, log) => {
        await inTx(root, async (ctx) => {
            let users = await FDB.User.findAll(ctx);
            let emails = new Set<string>();
            for (let u of users) {
                if (u.status !== 'deleted') {
                    emails.add(u.email);
                }
            }
            for (let e of emails) {
                let us = users.filter((v) => v.status !== 'deleted' && v.email === e);
                if (us.length > 1) {
                    let allPending = !us.find((v) => v.status !== 'pending');
                    if (allPending) {
                        let primary = us.find((v) => v.authId.startsWith('google-oauth2|'))!;
                        if (!primary) {
                            primary = us[0];
                        }
                        for (let u of us) {
                            if (u.id === primary.id) {
                                continue;
                            }
                            u.status = 'deleted';
                            log.log(ctx, 'Delete user #' + u.id);
                        }
                    }
                }
            }
        });
    }
});

migrations.push({
    key: '31-delete-duplicated-manual',
    migration: async (root, log) => {
        await inTx(root, async (ctx) => {
            let users = [1076, 176, 535, 577, 748, 728, 754, 868, 1079, 1118, 1103];
            for (let u of users) {
                let u2 = (await FDB.User.findById(ctx, u));
                if (u2) {
                    u2!.status = 'deleted';
                }
            }
        });
    }
});

migrations.push({
    key: '33-reindex-users',
    migration: async (root, log) => {
        let allKeys = await FDB.User.findAllKeys(root);
        let keyBatches = batch(allKeys, 100);
        for (let kb of keyBatches) {
            await inTx(root, async (ctx) => {
                for (let a of kb) {
                    let k = FKeyEncoding.decodeKey(a);
                    k.splice(0, 2);
                    let u = (await FDB.User.findById(ctx, k[0] as number));
                    if (!u) {
                        log.warn(ctx, 'no user found! ' + JSON.stringify(k));
                    } else {
                        u.markDirty();
                    }
                }
            });
        }
    }
});

migrations.push({
    key: '35-user-influencer',
    migration: async (root, log) => {
        await inTx(root, async (ctx) => {
            let edges = await FDB.UserEdge.findAll(ctx);
            let counters = new Map<number, number>();
            for (let e of edges) {
                if (counters.has(e.uid2)) {
                    counters.set(e.uid2, counters.get(e.uid2)! + 1);
                } else {
                    counters.set(e.uid2, 1);
                }
            }
            for (let k of counters.keys()) {
                let e = await FDB.UserInfluencerUserIndex.findById(ctx, k);
                if (e) {
                    e.value = counters.get(k)!;
                } else {
                    await FDB.UserInfluencerUserIndex.create(ctx, k, { value: counters.get(k)! });
                }
            }
        });
    }
});

migrations.push({
    key: '36-authTokens-add-enabled',
    migration: async (root, log) => {
        let allKeys = await FDB.AuthToken.findAllKeys(root);
        let keyBatches = batch(allKeys, 100);
        for (let kb of keyBatches) {
            await inTx(root, async (ctx) => {
                for (let a of kb) {
                    let k = FKeyEncoding.decodeKey(a);
                    k.splice(0, 2);
                    let t = (await FDB.AuthToken.findById(ctx, k[0] as string));
                    if (!t) {
                        log.warn(ctx, 'no token found! ' + JSON.stringify(k));
                    } else {
                        t.enabled = true;
                        t.markDirty();
                        await t.flush();
                    }
                }
            });
        }
    }
});

migrations.push({
    key: '35-user-influencer',
    migration: async (root, log) => {
        await inTx(root, async (ctx) => {
            let edges = await FDB.UserEdge.findAll(ctx);
            let counters = new Map<number, number>();
            for (let e of edges) {
                if (counters.has(e.uid2)) {
                    counters.set(e.uid2, counters.get(e.uid2)! + 1);
                } else {
                    counters.set(e.uid2, 1);
                }
            }
            for (let k of counters.keys()) {
                let e = await FDB.UserInfluencerUserIndex.findById(ctx, k);
                if (e) {
                    e.value = counters.get(k)!;
                } else {
                    await FDB.UserInfluencerUserIndex.create(ctx, k, { value: counters.get(k)! });
                }
            }
        });
    }
});

migrations.push({
    key: '37-reindex-room-profiles',
    migration: async (root, log) => {
        let allKeys = await FDB.RoomProfile.findAllKeys(root);
        let keyBatches = batch(allKeys, 100);
        for (let kb of keyBatches) {
            await inTx(root, async (ctx) => {
                for (let a of kb) {
                    let k = FKeyEncoding.decodeKey(a);
                    k.splice(0, 2);
                    let r = (await FDB.RoomProfile.findById(ctx, k[0] as number));
                    if (!r) {
                        log.warn(ctx, 'no room profile found! ' + JSON.stringify(k));
                    } else {
                        r.markDirty();
                    }
                }
            });
        }
    }
});

migrations.push({
    key: '38-reindex-messages',
    migration: async (root, log) => {
        let messageSequence = await FDB.Sequence.findById(root, 'message-id');
        if (!messageSequence) {
            return;
        }
        let messagesCount = messageSequence.value;

        let allIds = Array.from(Array(messagesCount + 1).keys()).slice(1);

        let keyBatches = batch(allIds, 100);
        let i = 0;
        for (let kb of keyBatches) {
            await inTx(root, async (ctx) => {
                for (let id of kb) {
                    let m = (await FDB.Message.findById(ctx, id));
                    if (!m) {
                        log.warn(ctx, 'no message found! id: %d', id);
                    } else {
                        if (m.repeatKey) {
                            if (await FDB.Message.findFromRepeat(ctx, m.id, m.cid, m.repeatKey)) {
                                log.warn(ctx, 'repeat message found! id: %d', id);
                                m.repeatKey = randomKey();
                            }
                        }
                        m.markDirty();
                    }
                    i++;
                }
                log.warn(ctx, '38-reindex-messages, done ' + i);
            });
        }
    }
});

migrations.push({
    key: '39-fix-room-creator',
    migration: async (root, log) => {
        let allKeys = await FDB.ConversationRoom.findAllKeys(root);
        let keyBatches = batch(allKeys, 100);
        for (let kb of keyBatches) {
            await inTx(root, async (ctx) => {
                for (let a of kb) {
                    let k = FKeyEncoding.decodeKey(a);
                    k.splice(0, 2);
                    let room = (await FDB.ConversationRoom.findById(ctx, k[0] as number));
                    if (!room) {
                        log.warn(ctx, 'no room found! ' + JSON.stringify(k));
                    } else {
                        let member = room.ownerId ? await FDB.RoomParticipant.findById(ctx, room.id, room.ownerId) : null;

                        if (member) {
                            member.role = 'owner';
                        }
                    }
                }
            });
        }
    }
});

migrations.push({
    key: '40-add-community-room-members-to-community',
    migration: async (root, log) => {
        let allKeys = await FDB.Organization.findAllKeys(root);
        let keyBatches = batch(allKeys, 100);
        for (let kb of keyBatches) {
            await inTx(root, async (ctx) => {
                for (let a of kb) {
                    let k = FKeyEncoding.decodeKey(a);
                    k.splice(0, 2);
                    let org = (await FDB.Organization.findById(ctx, k[0] as number));
                    if (!org) {
                        log.warn(ctx, 'no org found! ' + JSON.stringify(k));
                    } else {
                        if (org.kind !== 'community') {
                            continue;
                        }
                        let chats = await FDB.ConversationRoom.allFromOrganizationPublicRooms(ctx, org.id);

                        for (let chat of chats) {
                            let members = await Modules.Messaging.room.findConversationMembers(ctx, chat.id);

                            for (let member of members) {
                                let user = await FDB.User.findById(ctx, member);

                                if (!user || user.status === 'deleted') {
                                    continue;
                                }
                                await Modules.Orgs.addUserToOrganization(ctx, member, org.id, member, true);
                            }
                        }
                    }
                }
            });
        }
    }
});

migrations.push({
    key: '41-reindex-user-profiles',
    migration: async (root, log) => {
        let allKeys = await FDB.UserProfile.findAllKeys(root);
        let keyBatches = batch(allKeys, 100);
        for (let kb of keyBatches) {
            await inTx(root, async (ctx) => {
                for (let a of kb) {
                    let k = FKeyEncoding.decodeKey(a);
                    k.splice(0, 2);
                    let r = (await FDB.UserProfile.findById(ctx, k[0] as number));
                    if (!r) {
                        log.warn(ctx, 'no user profile found! ' + JSON.stringify(k));
                    } else {
                        r.markDirty();
                    }
                }
            });
        }
    }
});

migrations.push({
    key: '42-reindex-users',
    migration: async (root, log) => {
        let k = await FDB.Organization.findAll(root);
        for (let o of k) {
            await Modules.Users.markForUndexing(root, o.id);
        }
    }
});

migrations.push({
    key: '43-reindex-organizations',
    migration: async (root, log) => {
        await reindexAllEntityWithOnePrimaryKey(root, log, FDB.Organization, 100);
    }
});

migrations.push({
    key: '44-reindex-presence',
    migration: async (root, log) => {
        let allKeys = await FDB.Presence.findAllKeys(root);
        let keyBatches = batch(allKeys, 100);
        for (let kb of keyBatches) {
            await inTx(root, async (ctx) => {
                for (let a of kb) {
                    let k = FKeyEncoding.decodeKey(a);
                    k.splice(0, 2);
                    let r = await FDB.Presence.findById(ctx, k[0] as number, k[1] as string);
                    if (!r) {
                        log.warn(ctx, 'no presence found! ' + JSON.stringify(k));
                    } else {
                        r.markDirty();
                    }
                }
            });
        }
    }
});

migrations.push({
    key: '45-reindex-users',
    migration: async (root, log) => {
        let k = await FDB.Organization.findAll(root);
        for (let o of k) {
            await Modules.Users.markForUndexing(root, o.id);
        }
    }
});

migrations.push({
    key: '46-reindex-users',
    migration: async (root, log) => {
        let k = await FDB.User.findAll(root);
        for (let o of k) {
            await Modules.Users.markForUndexing(root, o.id);
        }
    }
});

migrations.push({
    key: '47-fix-user-messaging-state',
    migration: async (root, log) => {
        let allKeys = await FDB.UserMessagingState.findAllKeys(root);
        let keyBatches = batch(allKeys, 100);
        for (let kb of keyBatches) {
            await inTx(root, async (ctx) => {
                for (let a of kb) {
                    let k = FKeyEncoding.decodeKey(a);
                    k.splice(0, 2);
                    let state = (await FDB.UserMessagingState.findById(ctx, k[0] as number));
                    if (!state) {
                        log.warn(ctx, 'no state found! ' + JSON.stringify(k));
                    } else {
                        state.seq += 100;
                        state.markDirty();
                    }
                }
            });
        }
    }
});

migrations.push({
    key: '47-reindex-users',
    migration: async (root, log) => {
        let k = await FDB.User.findAll(root);
        for (let o of k) {
            await Modules.Users.markForUndexing(root, o.id);
        }
    }
});

//
// !! Run only on entities with one primary key !!
//
async function reindexAllEntityWithOnePrimaryKey<T extends FEntity>(parent: Context, log: SLog, entity: FEntityFactory<T>, batchSize: number) {
    let allKeys = await entity.findAllKeys(parent);
    let keyBatches = batch(allKeys, batchSize);
    for (let kb of keyBatches) {
        await inTx(parent, async (ctx) => {
            for (let a of kb) {
                let k = FKeyEncoding.decodeKey(a);
                k.splice(0, 2);
                let r = await ((entity as any).findById(ctx, k[0] as number));
                if (!r) {
                    log.warn(ctx, 'no entity found! ' + JSON.stringify(k));
                } else {
                    r.markDirty();
                }
            }
        });
    }
}

export function startMigrationsWorker() {
    if (serverRoleEnabled('workers')) {
        staticWorker({ name: 'foundation-migrator' }, async (ctx) => {
            await performMigrations(ctx, FDB.connection, migrations);
            return false;
        });
    }
}