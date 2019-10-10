import { injectable } from 'inversify';
import { lazyInject } from '../../openland-modules/Modules.container';
import { MatchmakingRepository, MatchmakingPeerType } from '../repositories/MatchmakingRepository';
import { Context } from '@openland/context';
import { Modules } from '../../openland-modules/Modules';
import { buildMessage, userMention } from '../../openland-utils/MessageBuilder';
import { MessageAttachmentInput } from '../../openland-module-messaging/MessageInput';
import { Store } from '../../openland-module-db/FDB';
import { IDs } from '../../openland-module-api/IDs';
import { makePhotoFallback } from '../../openland-module-messaging/workers/UrlInfoService';
import { GQL } from '../../openland-module-api/schema/SchemaSpec';
import MatchmakingAnswerInput = GQL.MatchmakingAnswerInput;
import MatchmakingRoomInput = GQL.MatchmakingRoomInput;
import { CacheRepository } from '../../openland-module-cache/CacheRepository';
import { plural } from '../../openland-utils/string';

type NotificationCacheInfo = {
    nid: number,
    date: string
};
let notificationsCache = new CacheRepository<NotificationCacheInfo>('matchmaking-notifications');

@injectable()
export class MatchmakingMediator {
    @lazyInject('MatchmakingRepository') private readonly repo!: MatchmakingRepository;

    getRoom = (ctx: Context, peerId: number, peerType: MatchmakingPeerType) => {
        return this.repo.getRoom(ctx, peerId, peerType);
    }

    getRoomProfiles = async (ctx: Context, peerId: number, peerType: MatchmakingPeerType) => {
        return this.repo.getRoomProfiles(ctx, peerId, peerType);
    }

    getRoomProfile = (ctx: Context, peerId: number, peerType: MatchmakingPeerType, uid: number) => {
        return this.repo.getRoomProfile(ctx, peerId, peerType, uid);
    }

    saveRoom = async (ctx: Context, peerId: number, peerType: MatchmakingPeerType, uid: number, input: MatchmakingRoomInput) => {
        let prevRoomEnabled = (await this.repo.getRoom(ctx, peerId, peerType)).enabled;
        let room = await this.repo.saveRoom(ctx, peerId, peerType, uid, input);
        if (peerType === 'room' && room.enabled !== prevRoomEnabled) {
            if (room.enabled) {
                await Modules.Messaging.sendMessage(ctx, peerId, uid, {
                    ...buildMessage(userMention(await Modules.Users.getUserFullName(ctx, uid), uid),
                        ' has enabled member profiles in this chat. Create your member profile to participate'),
                    isService: true,
                });
            } else {
                await Modules.Messaging.sendMessage(ctx, peerId, uid, {
                    ...buildMessage(userMention(await Modules.Users.getUserFullName(ctx, uid), uid),
                        ' has disabled member profiles in this chat.'),
                    isService: true,
                });
            }
        }
        return room;
    }

    fillRoomProfile = async (ctx: Context, peerId: number, peerType: MatchmakingPeerType, uid: number, answers: MatchmakingAnswerInput[]) => {
        let prevProfile = await this.repo.getRoomProfile(ctx, peerId, peerType, uid);
        let profile = await this.repo.fillRoomProfile(ctx, peerId, peerType, uid, answers);

        if (peerType === 'room' && !prevProfile) {
            let members = await Modules.Messaging.room.findConversationMembers(ctx, peerId);
            await Promise.all(members.map(async member => {
                if (member === uid) {
                    return;
                }
                if (!(await this.getRoomProfile(ctx, peerId, peerType, member))) {
                    return;
                }

                let now = new Date();
                let today = `${now.getDate()}/${now.getMonth()}/${now.getFullYear()}`;
                let cacheKey = [member, peerId, peerType].join(',');

                let prevNotificationInfo = await notificationsCache.read(ctx, cacheKey);
                let uids = [uid];
                if (prevNotificationInfo && prevNotificationInfo.date === today) {
                    let prevNotification = await Store.Notification.findById(ctx, prevNotificationInfo.nid);
                    if (prevNotification) {
                        let content = prevNotification.content!.find(a => a.type === 'new_matchmaking_profiles');
                        if (content && content.type === 'new_matchmaking_profiles') {
                            uids = uids.concat(content.uids);
                        }
                        uids = [...new Set(uids)];

                        await Modules.NotificationCenter.deleteNotification(ctx, prevNotification.id);
                    }
                }

                let notification = await Modules.NotificationCenter.sendNotification(ctx, member, {
                    content: [{
                        type: 'new_matchmaking_profiles',
                        peerId,
                        peerType,
                        uids: uids
                    }],
                    text: await this.getTextForNotification(ctx, uids)
                });
                await notificationsCache.write(ctx, cacheKey, {
                    date: today,
                    nid: notification.id
                });
            }));
        }

        return profile;
    }

    clearProfile = (ctx: Context, peerId: number, peerType: MatchmakingPeerType, uid: number)  => {
        return this.repo.clearProfile(ctx, peerId, peerType, uid);
    }

    connect = async (ctx: Context, peerId: number, peerType: MatchmakingPeerType, uid: number, uid2: number) => {
        if (!(await this.getRoomProfile(ctx, peerId, peerType, uid)) || !(await this.getRoomProfile(ctx, peerId, peerType, uid2))) {
            return false;
        }
        if (await Modules.Messaging.room.hasPrivateChat(ctx, uid, uid2)) {
            return false;
        }
        let conv = await Modules.Messaging.room.resolvePrivateChat(ctx, uid, uid2);
        await Modules.Messaging.sendMessage(ctx, conv.id, uid, {
            ...buildMessage(
                userMention(await Modules.Users.getUserFullName(ctx, uid), uid),
                ' and ',
                userMention(await Modules.Users.getUserFullName(ctx, uid2), uid2),
                ' you’re matched in Matchmaking chat',
            ),
            isService: true,
        });

        let attachmentUser1 = await this.getProfileAttachmentForUser(ctx, peerId, peerType, uid);
        await Modules.Messaging.sendMessage(ctx, conv.id, uid, {
            attachments: [attachmentUser1],
        });

        let attachmentUser2 = await this.getProfileAttachmentForUser(ctx, peerId, peerType, uid2);
        await Modules.Messaging.sendMessage(ctx, conv.id, uid2, {
            attachments: [attachmentUser2],
        });

        return true;
    }

    private getProfileAttachmentForUser = async (ctx: Context, peerId: number, peerType: MatchmakingPeerType, uid: number): Promise<MessageAttachmentInput> => {
        let user = await Store.UserProfile.findById(ctx, uid);
        let org = user!.primaryOrganization ? await Store.OrganizationProfile.findById(ctx, user!.primaryOrganization) : null;
        let profile = await this.getRoomProfile(ctx, peerId, peerType, uid);
        let question = profile!.answers ? profile!.answers.find(a => a.question.title === 'Interested in') : null;
        return {
            type: 'rich_attachment' as any,
            title: await Modules.Users.getUserFullName(ctx, uid),
            titleLink: `https://openland.com/${IDs.User.serialize(uid)}`,
            titleLinkHostname: null,
            subTitle: org ? org.name : null,
            text: (question && question.type === 'multiselect') ? question.tags.join(', ') : null,
            icon: null,
            iconInfo: null,
            image: user!.picture,
            imageInfo: user!.picture ? await Modules.Media.fetchFileInfo(ctx, user!.picture.uuid) : null,
            imageFallback: makePhotoFallback(IDs.User.serialize(user!.id), user!.firstName + ' ' + user!.lastName),
            imagePreview: user!.picture ? await Modules.Media.fetchLowResPreview(ctx, user!.picture.uuid) : null,
            keyboard: {
                buttons: [[
                    { title: 'View details', style: 'DEFAULT', url: `https://openland.com/mail/${IDs.User.serialize(uid)}` },
                ]],
            },
        };
    }

    private getTextForNotification = async (ctx: Context, uids: number[]) => {
        let text = `New member ${plural(uids.length, ['profile', 'profiles'])} from ${await Modules.Users.getUserFullName(ctx, uids[0])}`;
        if (uids.length === 2) {
            text += ` and ${await Modules.Users.getUserFullName(ctx, uids[1])}`;
        } else if (uids.length > 2) {
            text += ` and ${uids.length - 1} others.`;
        }

        return text;
    }
}