import { createLogger } from '@openland/log';
import { Modules } from 'openland-modules/Modules';
import { MigrationDefinition } from '@openland/foundationdb-migrations/lib/MigrationDefinition';
import { Store } from 'openland-module-db/FDB';
import { inTx, encoders } from '@openland/foundationdb';
import { fetchNextDBSeq } from '../openland-utils/dbSeq';
import uuid from 'uuid';

// @ts-ignore
const logger = createLogger('migration');

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
                    dc.set(ctx, [d.uid, d.cid], { date: d.date! });
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
                    event.content = { richMessageId: richMessage.id };
                }
            }
        });
    }
});

migrations.push({
    key: '111-notifications-fix',
    migration: async (parent) => {
        await inTx(parent, async ctx => {
            let settings = (await Store.UserSettings.findAll(ctx));

            for (let s of settings) {
                let commentsEnabled = s.commentNotifications ? s.commentNotifications !== 'none' : true;
                let mobileIncludeText: 'name_text' | 'name' = (s.mobileIncludeText == null || s.mobileIncludeText) ? 'name_text' : 'name';

                if (s.mobileAlert === null) {
                    s.mobile = {
                        direct: {
                            showNotification: true,
                            sound: true,
                        },
                        communityChat: {
                            showNotification: true,
                            sound: true
                        },
                        organizationChat: {
                            showNotification: true,
                            sound: true
                        },
                        secretChat: {
                            showNotification: true,
                            sound: true
                        },
                        comments: {
                            showNotification: commentsEnabled,
                            sound: commentsEnabled,
                        },
                        notificationPreview: mobileIncludeText,
                    };
                }

                await s.flush(ctx);
            }
        });
    }
});

migrations.push({
    key: '112-notifications-enable-all',
    migration: async (parent) => {
        await inTx(parent, async ctx => {
            let settings = (await Store.UserSettings.findAll(ctx));

            for (let s of settings) {
                let allEnabled = {
                    direct: {
                        showNotification: true,
                        sound: true,
                    }, communityChat: {
                        showNotification: true,
                        sound: true
                    }, organizationChat: {
                        showNotification: true,
                        sound: true
                    }, secretChat: {
                        showNotification: true,
                        sound: true
                    }, comments: {
                        showNotification: true, sound: true,
                    },
                    notificationPreview: 'name_text' as any,
                };

                s.mobile = allEnabled;
                s.desktop = allEnabled;

                await s.flush(ctx);
            }
        });
    }
});

migrations.push({
    key: '113-fix-feed-channels',
    migration: async (parent) => {
        await inTx(parent, async ctx => {
            let channels = (await Store.FeedChannel.findAll(ctx));
            for (let channel of channels) {
                channel.type = 'open';
            }
        });
    }
});

migrations.push({
    key: '114-oauth-app-fix-keys',
    migration: async (parent) => {
        await inTx(parent, async ctx => {
            let data = await Store.OauthApplication.findAll(ctx);
            for (let item of data) {
                item.invalidate();
                await item.flush(ctx);
            }
        });

        await inTx(parent, async ctx => {
            let primaryIndexData = await Store.OauthApplication.descriptor.subspace.range(ctx, []);
            for (let item of primaryIndexData) {
                if (typeof item.key[0] === 'string') {
                    await Store.OauthApplication.descriptor.subspace.clear(ctx, item.key);
                }
            }

            for (let index of Store.OauthApplication.descriptor.secondaryIndexes) {
                if (index.name !== 'user') {
                    continue;
                }
                let items = await index.subspace.range(ctx, []);
                for (let item of items) {
                    if (typeof item.key[2] === 'string') {
                        await index.subspace.clear(ctx, item.key);
                    }
                }
            }
        });
    }
});

migrations.push({
    key: '115-stickers-populate-related-emojis',
    migration: async (parent) => {
        await inTx(parent, async ctx => {
            let stickers = await Store.Sticker.findAll(ctx);
            for (let sticker of stickers) {
                sticker.relatedEmojis = [sticker.emoji];
            }
        });
    }
});

migrations.push({
    key: '116-move-unicorn-to-top',
    migration: async (parent) => {
        let data = await inTx(parent, ctx => Store.UserStickersState.findAll(ctx));
        for (let cursor = 0; cursor < data.length; cursor += 100) {
            let batch = data.slice(cursor, cursor + 100);
            await inTx(parent, async ctx => {
                for (let key of batch) {
                    let item = await Store.UserStickersState.findById(ctx, key.uid);
                    item!.packIds = item!.packIds.filter((a) => a !== 21);
                    item!.packIds = [21, ...item!.packIds];
                    await item!.flush(ctx);
                }
            });
        }
    }
});

migrations.push({
    key: '117-add-locked-balance',
    migration: async (parent) => {
        let data = await inTx(parent, ctx => Store.Wallet.findAll(ctx));
        for (let cursor = 0; cursor < data.length; cursor += 100) {
            let batch = data.slice(cursor, cursor + 100);
            await inTx(parent, async ctx => {
                for (let key of batch) {
                    let item = (await Store.Wallet.findById(ctx, key.uid))!;
                    if (item.balanceLocked === null) {
                        item.balanceLocked = 0;
                    }
                    await item!.flush(ctx);
                }
            });
        }
    }
});

migrations.push({
    key: '118-fix-locked-balance',
    migration: async (parent) => {
        let data = await inTx(parent, ctx => Store.Wallet.findAll(ctx));
        for (let cursor = 0; cursor < data.length; cursor += 100) {
            let batch = data.slice(cursor, cursor + 100);
            await inTx(parent, async ctx => {
                for (let key of batch) {
                    let item = (await Store.Wallet.findById(ctx, key.uid))!;
                    if (!item.balanceLocked) {
                        item.balanceLocked = 0;
                    }
                    await item!.flush(ctx);
                }
            });
        }
    }
});

migrations.push({
    key: '119-fix-deleted-default-cards',
    migration: async (parent) => {
        let data = await inTx(parent, ctx => Store.UserStripeCard.findAll(ctx));
        for (let cursor = 0; cursor < data.length; cursor += 100) {
            let batch = data.slice(cursor, cursor + 100);
            await inTx(parent, async ctx => {
                for (let key of batch) {
                    let item = (await Store.UserStripeCard.findById(ctx, key.uid, key.pmid))!;
                    if (item.deleted) {
                        item.default = false;
                    }
                    await item!.flush(ctx);
                }
            });
        }
    }
});

migrations.push({
    key: '120-set-authIds-to-uuid',
    migration: async (parent) => {
        let data = await inTx(parent, ctx => Store.User.findAll(ctx));
        for (let cursor = 0; cursor < data.length; cursor += 100) {
            let batch = data.slice(cursor, cursor + 100);
            await inTx(parent, async ctx => {
                for (let key of batch) {
                    let item = (await Store.User.findById(ctx, key.id))!;
                    if (item) {
                        item.authId = uuid();
                        await item.flush(ctx);
                    }
                }
            });
        }
    }
});

// migrations.push({
//     key: '121-conference-stream-add-seq',
//     migration: async (parent) => {
//         let data = await inTx(parent, ctx => Store.ConferenceMediaStream.findAll(ctx));
//         for (let cursor = 0; cursor < data.length; cursor += 100) {
//             let batch = data.slice(cursor, cursor + 100);
//             await inTx(parent, async ctx => {
//                 for (let key of batch) {
//                     let item = (await Store.ConferenceMediaStream.findById(ctx, key.id))!;
//                     if (item) {
//                         item.seq = 0;
//                         await item.flush(ctx);
//                     }
//                 }
//             });
//         }
//     }
// });

migrations.push({
    key: '122-conference-update-strategy-field',
    migration: async (parent) => {
        let data = await inTx(parent, ctx => Store.ConferenceRoom.findAll(ctx));
        for (let cursor = 0; cursor < data.length; cursor += 100) {
            let batch = data.slice(cursor, cursor + 100);
            await inTx(parent, async ctx => {
                for (let key of batch) {
                    let item = (await Store.ConferenceRoom.findById(ctx, key.id))!;
                    if (item) {
                        // item.strategy = 'mash';
                        item.kind = 'conference';
                        await item.flush(ctx);
                    }
                }
            });
        }
    }
});

migrations.push({
    key: '122-fix-conference',
    migration: async (parent) => {
        let data = await inTx(parent, ctx => Store.ConferenceRoom.findAll(ctx));
        for (let cursor = 0; cursor < data.length; cursor += 100) {
            let batch = data.slice(cursor, cursor + 100);
            await inTx(parent, async ctx => {
                for (let key of batch) {
                    let item = (await Store.ConferenceRoom.findById(ctx, key.id))!;
                    if (item) {
                        // item.strategy = 'mash';
                        item.kind = 'conference';
                        await item.flush(ctx);
                    }
                }
            });
        }
    }
});

migrations.push({
    key: '124-reindex-members',
    migration: async (parent) => {
        let dir = Store.RoomParticipantsActiveDirectory
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean);
        let data = await inTx(parent, ctx => Store.RoomParticipant.findAll(ctx));
        for (let cursor = 0; cursor < data.length; cursor += 100) {
            let batch = data.slice(cursor, cursor + 100);
            await inTx(parent, async ctx => {
                for (let key of batch) {
                    let item = (await Store.RoomParticipant.findById(ctx, key.cid, key.uid))!;
                    if (item) {
                        if (item.status === 'joined') {
                            dir.set(ctx, [key.cid, key.uid], false);
                        } else {
                            dir.clear(ctx, [key.cid, key.uid]);
                        }
                    }
                }
            });
        }
    }
});

migrations.push({
    key: '128-workers-counters',
    migration: async (parent) => {

        let tasks = [Store.MessageDeliveryBatchDirectory, Store.MessageDeliveryDirectory];

        for (let dir of tasks) {
            let counters = dir
                .withKeyEncoding(encoders.tuple)
                .withValueEncoding(encoders.int32LE)
                .subspace([2]);
            let ids = dir
                .withKeyEncoding(encoders.tuple)
                .withValueEncoding(encoders.boolean)
                .subspace([0]);

            await inTx(parent, async (ctx) => {
                let range = await ids.range(ctx, []);
                counters.set(ctx, [1], range.length);
            });
        }
    }
});

migrations.push({
    key: '129-workers',
    migration: async (parent) => {

        let tasks = [Store.MessageDeliveryBatchDirectory, Store.MessageDeliveryDirectory];

        for (let dir of tasks) {
            await inTx(parent, async ctx => {
                let ids = dir
                    .withKeyEncoding(encoders.tuple)
                    .withValueEncoding(encoders.boolean)
                    .subspace([0]);

                let idsPending = dir
                    .withKeyEncoding(encoders.tuple)
                    .withValueEncoding(encoders.boolean)
                    .subspace([4]);

                let taskIds = (await ids.range(ctx, [])).map((v) => v.key[v.key.length - 1] as string);

                taskIds.forEach(id => idsPending.set(ctx, [id], true));
            });
        }
    }
});

migrations.push({
    key: '130-workers-counters',
    migration: async (parent) => {

        let tasks = [Store.MessageDeliveryBatchDirectory, Store.MessageDeliveryDirectory];

        for (let dir of tasks) {
            let counters = dir
                .withKeyEncoding(encoders.tuple)
                .withValueEncoding(encoders.int32LE)
                .subspace([2]);
            let ids = dir
                .withKeyEncoding(encoders.tuple)
                .withValueEncoding(encoders.boolean)
                .subspace([0]);

            await inTx(parent, async (ctx) => {
                let range = await ids.range(ctx, []);
                counters.set(ctx, [1], range.length);
            });
        }
    }
});

// migrations.push({
//     key: '131-migrate-chat-mute',
//     migration: async (parent) => {
//         let muteDirectory = Store.UserDialogMuteSettingDirectory
//             .withKeyEncoding(encoders.tuple)
//             .withValueEncoding(encoders.boolean);
//
//         let settings = await inTx(parent, async ctx => Store.UserDialogSettings.findAll(ctx));
//         let batches = batchFn(settings, 100);
//
//         for (let b of batches) {
//             await inTx(parent, async ctx => {
//                 for (let s of b) {
//                     if (s.mute) {
//                         muteDirectory.set(ctx, [s.uid, s.cid], true);
//                     }
//                 }
//             });
//         }
//     }
// });

migrations.push({
    key: '134-migrate-presence',
    migration: async (parent) => {
        let data = await inTx(parent, ctx => Store.User.findAll(ctx));
        for (let cursor = 0; cursor < data.length; cursor += 100) {
            let batch = data.slice(cursor, cursor + 100);
            await inTx(parent, async ctx => {
                for (let key of batch) {
                    for (let presence of await Store.Presence.user.findAll(ctx, key.id)) {
                        if (presence.lastSeen > 0) {
                            await Modules.Presence.users.repo.setOnline(ctx, key.id, presence.tid, presence.lastSeen, presence.lastSeenTimeout, !!presence.active);
                        }
                    }
                }
            });
        }
    }
});

migrations.push({
    key: '135-migrate-mobile-flag',
    migration: async (parent) => {
        const isMobile = (p: string) => (p.startsWith('android') || p.startsWith('ios'));
        let data = await inTx(parent, ctx => Store.User.findAll(ctx));
        for (let cursor = 0; cursor < data.length; cursor += 100) {
            let batch = data.slice(cursor, cursor + 100);
            await inTx(parent, async ctx => {
                for (let key of batch) {
                    let hasMobilePresence = !!(await Store.Presence.user.findAll(ctx, key.id))
                        .find((e) => isMobile(e.platform));
                    if (hasMobilePresence) {
                        Modules.Presence.logging.setMobile(ctx, key.id);
                    }
                }
            });
        }
    }
});

migrations.push({
    key: '136-migrate-platform',
    migration: async (parent) => {
        let data = await inTx(parent, ctx => Store.User.findAll(ctx));
        for (let cursor = 0; cursor < data.length; cursor += 100) {
            let batch = data.slice(cursor, cursor + 100);
            await inTx(parent, async ctx => {
                for (let key of batch) {
                    for (let pres of await Store.Presence.user.findAll(ctx, key.id)) {
                        let token = await Store.AuthToken.findById(ctx, pres.tid);
                        if (token) {
                            token.platform = pres.platform;
                        }
                    }
                }
            });
        }
    }
});

// migrations.push({
//     key: '137-create-user-feeds',
//     migration: async (parent) => {
//         let data = await inTx(parent, ctx => Store.User.findAll(ctx));
//         for (let cursor = 0; cursor < data.length; cursor += 100) {
//             let batch = data.slice(cursor, cursor + 100);
//             await inTx(parent, async ctx => {
//                 for (let u of batch) {
//                     await Modules.Events.mediator.prepareUser(ctx, u.id);
//                 }
//             });
//         }
//     }
// });

// migrations.push({
//     key: '140-drop-feeds',
//     migration: async (parent) => {
//         await inTx(parent, async ctx => {
//             Store.EventsTestStoreDirectory.clearPrefixed(ctx, Buffer.from([]));
//             Store.EventsTestRegistrationsDirectory.clearPrefixed(ctx, Buffer.from([]));
//         });
//     }
// });

// migrations.push({
//     key: '139-create-user-feeds',
//     migration: async (parent) => {
//         let data = await inTx(parent, ctx => Store.User.findAll(ctx));
//         for (let cursor = 0; cursor < data.length; cursor += 100) {
//             let batch = data.slice(cursor, cursor + 100);
//             await inTx(parent, async ctx => {
//                 for (let u of batch) {
//                     await Modules.Events.mediator.prepareUser(ctx, u.id);
//                 }
//             });
//         }
//     }
// });

// migrations.push({
//     key: '141-drop-feeds',
//     migration: async (parent) => {
//         await inTx(parent, async ctx => {
//             Store.EventsTestStoreDirectory.clearPrefixed(ctx, Buffer.from([]));
//             Store.EventsTestRegistrationsDirectory.clearPrefixed(ctx, Buffer.from([]));
//         });
//     }
// });

// migrations.push({
//     key: '142-create-user-feeds',
//     migration: async (parent) => {
//         let data = await inTx(parent, ctx => Store.User.findAll(ctx));
//         for (let cursor = 0; cursor < data.length; cursor += 100) {
//             let batch = data.slice(cursor, cursor + 100);
//             await inTx(parent, async ctx => {
//                 for (let u of batch) {
//                     await Modules.Events.mediator.prepareUser(ctx, u.id);
//                 }
//             });
//         }
//     }
// });

// migrations.push({
//     key: '144-create-conversation-feeds',
//     migration: async (parent) => {
//         let after = 0;
//         while (true) {
//             let ex = await Store.Conversation.descriptor.subspace.range(parent, [], { after: [after], limit: 100 });
//             if (ex.length === 0) {
//                 break;
//             }
//             let ids = ex.map((e) => e.key[0] as number);
//             logger.log(parent, 'Apply conversation ' + after);
//             await inTx(parent, async ctx => {
//                 for (let u of ids) {
//                     await Modules.Events.mediator.prepareChat(ctx, u);
//                     let conv = await Store.ConversationPrivate.findById(ctx, u);
//                     if (conv) {
//                         await Modules.Events.mediator.preparePrivateChat(ctx, u, conv.uid1);
//                         await Modules.Events.mediator.preparePrivateChat(ctx, u, conv.uid2);
//                     }
//                 }
//             });

//             after = ex[ex.length - 1].key[0] as number;
//         }
//     }
// });

// migrations.push({
//     key: '145-drop-feeds',
//     migration: async (parent) => {
//         await inTx(parent, async ctx => {
//             Store.EventsTestStoreDirectory.clearPrefixed(ctx, Buffer.from([]));
//             Store.EventsTestRegistrationsDirectory.clearPrefixed(ctx, Buffer.from([]));
//             Store.EventStorageDirectory.clearPrefixed(ctx, Buffer.from([]));
//             Store.EventRegistrationsDirectory.clearPrefixed(ctx, Buffer.from([]));
//             Store.EventUserSeqDirectory.clearPrefixed(ctx, Buffer.from([]));
//             Store.EventsStoreFeedCount.directory.clearPrefixed(ctx, Buffer.from([]));
//             Store.EventsStoreSubscriberCount.directory.clearPrefixed(ctx, Buffer.from([]));
//         });
//     }
// });

migrations.push({
    key: '148-create-user-feeds',
    migration: async (parent) => {
        let data = await inTx(parent, ctx => Store.User.findAll(ctx));
        for (let cursor = 0; cursor < data.length; cursor += 100) {
            logger.log(parent, 'Apply users ' + cursor);
            let batch = data.slice(cursor, cursor + 100);
            await inTx(parent, async ctx => {
                for (let u of batch) {
                    await Modules.Events.mediator.prepareUser(ctx, u.id);
                }
            });
        }
    }
});

migrations.push({
    key: '149-create-conversation-feeds',
    migration: async (parent) => {
        let after = 0;
        while (true) {
            let ex = await Store.Conversation.descriptor.subspace.range(parent, [], { after: [after], limit: 100 });
            if (ex.length === 0) {
                break;
            }
            let ids = ex.map((e) => e.key[0] as number);
            logger.log(parent, 'Apply conversation ' + after + ': ' + ids.length);
            await inTx(parent, async ctx => {
                await Promise.all(ids.map(async (u) => {
                    await Modules.Events.mediator.prepareChat(ctx, u);
                    let conv = await Store.ConversationPrivate.findById(ctx, u);
                    if (conv) {
                        await Modules.Events.mediator.preparePrivateChat(ctx, u, conv.uid1);
                        await Modules.Events.mediator.preparePrivateChat(ctx, u, conv.uid2);
                    }
                }));
            });

            after = ex[ex.length - 1].key[0] as number;
        }
    }
});

migrations.push({
    key: '150-create-conversation-feeds',
    migration: async (parent) => {
        let after = 0;
        while (true) {
            let ex = await Store.Conversation.descriptor.subspace.range(parent, [], { after: [after], limit: 500 });
            if (ex.length === 0) {
                break;
            }
            let ids = ex.map((e) => e.key[0] as number);
            logger.log(parent, 'Apply conversation ' + after + ': ' + ids.length);
            await inTx(parent, async ctx => {
                await Promise.all(ids.map(async (u) => {
                    await Modules.Events.mediator.prepareChat(ctx, u);
                    let conv = await Store.ConversationPrivate.findById(ctx, u);
                    if (conv) {
                        await Modules.Events.mediator.preparePrivateChat(ctx, u, conv.uid1);
                        await Modules.Events.mediator.preparePrivateChat(ctx, u, conv.uid2);
                    }
                }));
            });

            after = ex[ex.length - 1].key[0] as number;
        }
    }
});

export default migrations;
