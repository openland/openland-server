import { DB } from 'openland-server/tables';
import { inTx } from 'foundation-orm/inTx';
import { FDB } from 'openland-module-db/FDB';
import { forever } from 'openland-server/utils/timer';

export function startMigrator() {
    forever(async () => {
        let items = await DB.Conversation.findAll();
        for (let i of items) {
            if (i.type === 'channel') {
                await inTx(async () => {
                    let sequence = await FDB.Sequence.findById('conversation-id');
                    if (!sequence) {
                        sequence = (await FDB.Sequence.create('conversation-id', { value: 1 }));
                        await sequence.flush();
                    }
                    sequence.value = Math.max(i.id, sequence.value);

                    let conversation = await FDB.Conversation.findById(i.id);
                    if (!conversation) {
                        await FDB.Conversation.create(i.id, {
                            kind: 'room'
                        });
                    }

                    let convRoom = await FDB.ConversationRoom.findById(i.id);
                    let members = await FDB.RoomParticipant.allFromActive(i.id);
                    if (members.length === 0) {
                        return;
                    }

                    if (!convRoom) {
                        let owner = members.find((v) => v.role === 'owner')!;
                        let admin = members.find((v) => v.role === 'admin')!;
                        await FDB.ConversationRoom.create(i.id, {
                            oid: i.extras.creatorOrgId as any,
                            kind: 'public',
                            ownerId: owner ? owner.uid : (admin ? admin.uid : members[0].uid),
                            featured: (i.extras.featured as boolean) || false,
                            listed: !(i.extras.hidden as boolean),
                        });
                    } else {
                        convRoom.featured = (i.extras.featured as boolean) || false;
                        convRoom.listed = !(i.extras.hidden as boolean);
                    }

                    let convProfile = await FDB.RoomProfile.findById(i.id);
                    if (!convProfile) {
                        await FDB.RoomProfile.create(i.id, {
                            title: i.title,
                            image: i.extras.picture,
                            description: i.extras.description as any,
                            socialImage: i.extras.socialImage as any
                        });
                    } else {
                        convProfile.title = i.title;
                        convProfile.image = i.extras.picture;
                        convProfile.description = i.extras.description as any;
                        convProfile.socialImage = i.extras.socialImage as any;
                    }
                });
            } else if (i.type === 'group') {
                await inTx(async () => {
                    let sequence = await FDB.Sequence.findById('conversation-id');
                    if (!sequence) {
                        sequence = (await FDB.Sequence.create('conversation-id', { value: 1 }));
                        await sequence.flush();
                    }
                    sequence.value = Math.max(i.id, sequence.value);

                    let members = await FDB.RoomParticipant.allFromActive(i.id);
                    if (members.length === 0) {
                        return;
                    }
                    let conversation = await FDB.Conversation.findById(i.id);
                    if (!conversation) {
                        await FDB.Conversation.create(i.id, {
                            kind: 'room'
                        });
                    }

                    let convRoom = await FDB.ConversationRoom.findById(i.id);
                    if (!convRoom) {
                        let owner = members.find((v) => v.role === 'owner')!;
                        let admin = members.find((v) => v.role === 'admin')!;
                        await FDB.ConversationRoom.create(i.id, {
                            kind: 'group',
                            ownerId: owner ? owner.uid : (admin ? admin.uid : members[0].uid)
                        });
                    }

                    let convProfile = await FDB.RoomProfile.findById(i.id);
                    if (!convProfile) {
                        await FDB.RoomProfile.create(i.id, {
                            title: i.title,
                            image: i.extras.picture,
                            description: i.extras.description as any,
                        });
                    } else {
                        convProfile.title = i.title;
                        convProfile.image = i.extras.picture;
                        convProfile.description = i.extras.description as any;
                    }
                });
            } else if (i.type === 'shared' && i.organization1Id === i.organization2Id) {
                await inTx(async () => {
                    let sequence = await FDB.Sequence.findById('conversation-id');
                    if (!sequence) {
                        sequence = (await FDB.Sequence.create('conversation-id', { value: 1 }));
                        await sequence.flush();
                    }
                    sequence.value = Math.max(i.id, sequence.value);

                    let conversation = await FDB.Conversation.findById(i.id);
                    if (!conversation) {
                        await FDB.Conversation.create(i.id, {
                            kind: 'organization'
                        });
                    } else {
                        conversation.kind = 'organization';
                    }

                    let convOrg = await FDB.ConversationOrganization.findById(i.id);
                    if (!convOrg) {
                        await FDB.ConversationOrganization.create(i.id, { oid: i.organization1Id! });
                    } else {
                        convOrg.oid = i.organization1Id!;
                    }
                });
            } else if (i.type === 'private') {
                await inTx(async () => {
                    let sequence = await FDB.Sequence.findById('conversation-id');
                    if (!sequence) {
                        sequence = (await FDB.Sequence.create('conversation-id', { value: 1 }));
                        await sequence.flush();
                    }
                    sequence.value = Math.max(i.id, sequence.value);

                    let conversation = await FDB.Conversation.findById(i.id);
                    if (!conversation) {
                        await FDB.Conversation.create(i.id, {
                            kind: 'private'
                        });
                    }

                    let conversationPrivate = await FDB.ConversationPrivate.findById(i.id);
                    if (!conversationPrivate) {
                        await FDB.ConversationPrivate.create(i.id, {
                            uid1: Math.min(i.member1Id!, i.member2Id!),
                            uid2: Math.max(i.member1Id!, i.member2Id!)
                        });
                    } else {
                        conversationPrivate.uid1 = Math.min(i.member1Id!, i.member2Id!);
                        conversationPrivate.uid2 = Math.max(i.member1Id!, i.member2Id!);
                    }
                });
            }
        }
    });
}