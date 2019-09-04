import { MigrationDefinition } from '@openland/foundationdb-migrations/lib/MigrationDefinition';
import { Store } from 'openland-module-db/FDB';
import { inTx, encoders } from '@openland/foundationdb';
import { fetchNextDBSeq } from '../openland-utils/dbSeq';

let migrations: MigrationDefinition[] = [];

migrations.push({
    key: '100-remove-invalid-presences',
    migration: async (parent) => {
        let subspaces = [
            Store.Presence.descriptor.subspace,
            ...Store.Presence.descriptor.secondaryIndexes.map((v) => v.subspace)
        ];
        for (let s of subspaces) {
            await inTx(parent, async (ctx) => {
                let all = await s.range(ctx, []);
                for (let a of all) {
                    if (typeof a.value.tid === 'number') {
                        s.clear(ctx, a.key);
                    }
                }
            });
        }
    }
});

migrations.push({
    key: '101-remove-invalid-web-push-tokenss',
    migration: async (parent) => {
        let subspaces = [
            Store.PushWeb.descriptor.subspace,
            ...Store.PushWeb.descriptor.secondaryIndexes.map((v) => v.subspace)
        ];
        for (let s of subspaces) {
            await inTx(parent, async (ctx) => {
                let all = await s.range(ctx, []);
                for (let a of all) {
                    if (typeof a.value.tid === 'number') {
                        s.clear(ctx, a.key);
                    }
                }
            });
        }
    }
});

migrations.push({
    key: '102-remove-invalid-apple-push-tokenss',
    migration: async (parent) => {
        let subspaces = [
            Store.PushApple.descriptor.subspace,
            ...Store.PushApple.descriptor.secondaryIndexes.map((v) => v.subspace)
        ];
        for (let s of subspaces) {
            await inTx(parent, async (ctx) => {
                let all = await s.range(ctx, []);
                for (let a of all) {
                    if (typeof a.value.tid === 'number') {
                        s.clear(ctx, a.key);
                    }
                }
            });
        }
    }
});

migrations.push({
    key: '103-remove-invalid-firebase-tokens',
    migration: async (parent) => {
        let subspaces = [
            Store.PushFirebase.descriptor.subspace,
            ...Store.PushFirebase.descriptor.secondaryIndexes.map((v) => v.subspace)
        ];
        for (let s of subspaces) {
            await inTx(parent, async (ctx) => {
                let all = await s.range(ctx, []);
                for (let a of all) {
                    if (typeof a.value.tid === 'number') {
                        s.clear(ctx, a.key);
                    }
                }
            });
        }
    }
});

migrations.push({
    key: '104-remove-invalid-safari-tokens',
    migration: async (parent) => {
        let subspaces = [
            Store.PushSafari.descriptor.subspace,
            ...Store.PushSafari.descriptor.secondaryIndexes.map((v) => v.subspace)
        ];
        for (let s of subspaces) {
            await inTx(parent, async (ctx) => {
                let all = await s.range(ctx, []);
                for (let a of all) {
                    if (typeof a.value.tid === 'number') {
                        s.clear(ctx, a.key);
                    }
                }
            });
        }
    }
});

migrations.push({
    key: '105-migrate-dialog-index',
    migration: async (parent) => {

        await inTx(parent, async (ctx) => {
            let dialogs = (await Store.UserDialog.findAll(ctx));
            let dc = Store.UserDialogIndexDirectory
                .withKeyEncoding(encoders.tuple)
                .withValueEncoding(encoders.json);
            for (let d of dialogs) {
                if (d.date) {
                    dc.set(ctx, [d.uid, d.cid], {date: d.date!});
                } else {
                    dc.clear(ctx, [d.uid, d.cid]);
                }
            }
        });
    }
});

migrations.push({
    key: '106-migrate-dialog-read-message-id',
    migration: async (parent) => {
        await inTx(parent, async (ctx) => {
            let dialogs = (await Store.UserDialog.findAll(ctx));

            for (let d of dialogs) {
                if (d.readMessageId) {
                    Store.UserDialogReadMessageId.set(ctx, d.uid, d.cid, d.readMessageId);
                }
            }
        });
    }
});

migrations.push({
    key: '107-enable-notifications',
    migration: async (parent) => {
        await inTx(parent, async (ctx) => {
            let settings = (await Store.UserSettings.findAll(ctx));

            for (let s of settings) {
                s.mobileNotifications = 'all';
                s.desktopNotifications = 'all';
            }
        });
    }
});

migrations.push({
    key: '109-new-notification-settings',
    migration: async (parent) => {
        await inTx(parent, async (ctx) => {
            let settings = (await Store.UserSettings.findAll(ctx));

            for (let s of settings) {
                let mobileAlertDirect = s.mobileNotifications === 'all' || s.mobileNotifications === 'direct';
                let mobileAlertChat = s.mobileNotifications === 'all';
                let mobileChatNotificationEnabled = !!s.mobileAlert && mobileAlertChat;
                let mobileDirectNotificationEnabled = !!s.mobileAlert && mobileAlertDirect;
                s.mobile = {
                    direct: {
                        showNotification: mobileDirectNotificationEnabled,
                        sound: mobileAlertDirect,
                    },
                    communityChat: {
                        showNotification: mobileChatNotificationEnabled,
                        sound: mobileAlertChat
                    },
                    organizationChat: {
                        showNotification: mobileChatNotificationEnabled,
                        sound: mobileAlertChat
                    },
                    secretChat: {
                        showNotification: mobileChatNotificationEnabled,
                        sound: mobileAlertChat
                    },
                    comments: {
                        showNotification: s.commentNotifications !== 'none',
                        sound: s.commentNotifications !== 'none',
                    },
                    notificationPreview: s.mobileIncludeText ? 'name_text' : 'name',
                };

                let desktopChatNotificationEnabled = s.desktopNotifications === 'all';
                let desktopDirectNotificationEnabled = s.desktopNotifications === 'all' || s.desktopNotifications === 'direct';
                s.desktop = {
                    direct: {
                        showNotification: desktopDirectNotificationEnabled,
                        sound: desktopDirectNotificationEnabled,
                    },
                    communityChat: {
                        showNotification: desktopChatNotificationEnabled,
                        sound: desktopChatNotificationEnabled
                    },
                    organizationChat: {
                        showNotification: desktopChatNotificationEnabled,
                        sound: desktopChatNotificationEnabled
                    },
                    secretChat: {
                        showNotification: desktopChatNotificationEnabled,
                        sound: desktopChatNotificationEnabled
                    },
                    comments: {
                        showNotification: s.commentNotifications !== 'none',
                        sound: s.commentNotifications !== 'none',
                    },
                    notificationPreview: 'name_text',
                };

                await s.flush(ctx);
            }
        });
    }
});

migrations.push({
    key: '110-migrate-feed',
    migration: async (parent) => {
        await inTx(parent, async (ctx) => {
            let events = await Store.FeedEvent.findAll(ctx);

            for (let event of events) {
                if (event.type === 'post' && !event.content.richMessageId) {
                    let messageId = await fetchNextDBSeq(parent, 'rich-message-id');
                    let richMessage = await Store.RichMessage.create(ctx, messageId, {
                        uid: event.content.uid,
                        text: event.content.text || '',
                    });
                    event.content = {richMessageId: richMessage.id};
                }
            }
        });
    }
});

export default migrations;