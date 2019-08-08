import { OrganizationInviteLink, ChannelInvitation } from './../openland-module-db/store';
import { inTx } from '@openland/foundationdb';
import { Modules } from 'openland-modules/Modules';
import { Comment, Message } from 'openland-module-db/store';
import { IDs } from 'openland-module-api/IDs';
import { Store } from 'openland-module-db/FDB';
import { Context } from '@openland/context';
import { splitEvery } from 'openland-utils/splitEvery';
import { FormatedUnreadGroups, FormatedUnreadGroup, FormatedTrendGroups, FormatedTrendGroup, FormatedTopPost, FormatedTopPosts } from 'openland-module-stats/StatsModule.types';
import { WeeklyDigestTemplateData, DIGEST_FIRST_UNREAD_GROUPS, DIGEST_FIRST_TREND_GROUPS } from './Emails.types';
import { getFilledSpans } from './EmailSpans';

export const TEMPLATE_WELCOME = 'c6a056a3-9d56-4b2e-8d50-7748dd28a1fb';
export const TEMPLATE_ACTIVATEED = 'e5b1d39d-35e9-4eba-ac4a-e0676b055346';
export const TEMPLATE_DEACTIVATED = 'e1e66916-41be-4719-8eca-7feb0828d600';
export const TEMPLATE_MEMBER_REMOVED = '8500f811-f29d-44f1-b1f6-c7975cdeae61';
export const TEMPLATE_MEMBERSHIP_LEVEL_CHANGED = '58c94c0c-a033-4406-935f-43fc5265e399';
export const TEMPLATE_INVITE = '024815a8-5602-4412-83f4-4be505c2026a';
export const TEMPLATE_MEMBER_JOINED = 'c76321cb-5560-4311-bdbf-e0fe337fa2cf';
export const TEMPLATE_UNREAD_MESSAGES = '02787351-db1c-49b5-afbf-3d63a3b7fd76';
export const TEMPLATE_UNREAD_MESSAGE = 'd3c583e1-9418-48ba-b719-4230e1e1d43d';
export const TEMPLATE_SIGNUP_CODE = '69496416-42cc-441d-912f-a918b968e34a';
export const TEMPLATE_SIGIN_CODE = '89aa70e4-5ac2-449f-b3ee-35df0df86cbe';
export const TEMPLATE_ROOM_INVITE = '3650c0cb-af99-403d-ad30-0b68af21f5ef';
export const TEMPLATE_PRIVATE_ROOM_INVITE = 'e988e7dd-ad37-4adc-9de9-cd55e012720f';
export const TEMPLATE_ROOM_INVITE_ACCEPTED = '5de5b56b-ebec-40b8-aeaf-360af17c213b';
export const TEMPLATE_UNREAD_COMMENT = 'a1f0b2e1-835f-4ffc-8ba2-c67f2a6cf6b3';
export const TEMPLATE_UNREAD_COMMENTS = '78f799d6-cb3a-4c06-bfeb-9eb98b9749cb';
export const TEMPLATE_WEEKLY_DIGEST = 'd-43e37b53d7ed4ef4afaf758b4a36ca24';

const isProd = process.env.APP_ENVIRONMENT === 'production';

const loadUserState = async (ctx: Context, uid: number) => {
    let user = await Store.User.findById(ctx, uid);
    if (!user) {
        throw Error('Internal inconsistency');
    }
    Modules.Hooks.onEmailSent(ctx, uid);
    let profile = await Modules.Users.profileById(ctx, uid);
    if (profile) {
        return {
            email: user.email!!,
            args: {
                'userWelcome': 'Hi, ' + profile.firstName,
                'userName': [profile.firstName, profile.lastName].filter((v) => v).join(' '),
                'userFirstName': profile.firstName,
                'userLastName': profile.lastName || '',

                'firstName': profile.firstName,
                'lastName': profile.lastName || ''
            }
        };
    } else {
        return {
            email: user.email!!,
            args: {
                'userWelcome': 'Hi',
                'userName': '',
                'userFirstName': '',
                'userLastName': '',
                'firstName': '',
                'lastName': ''
            }
        };
    }
};

export const Emails = {
    async sendWelcomeEmail(ctx: Context, uid: number) {
        let user = await loadUserState(ctx, uid);
        await Modules.Email.enqueueEmail(ctx, {
            subject: 'Welcome to Openland!',
            templateId: TEMPLATE_WELCOME,
            to: user.email,
            args: user.args
        });
    },
    async sendUnreadMessages(ctx: Context, uid: number, messages: Message[]) {
        let user = await loadUserState(ctx, uid);

        if (messages.length > 1) {

            let chatNames = new Set<string>();

            for (let msg of messages) {
                let chatName = await Modules.Messaging.room.resolveConversationTitle(ctx, msg.cid, uid);
                chatNames.add(`<strong>${chatName}</strong>`);
            }

            let chatNamesArr = [...chatNames];

            let text = 'You have messages from ';

            text += chatNamesArr.slice(0, 3).join(', ');

            if (chatNamesArr.length > 3) {
                text += ` and ${chatNamesArr.length - 3} more`;
            }

            text += '.';

            await Modules.Email.enqueueEmail(ctx, {
                subject: 'You’ve got new messages',
                templateId: TEMPLATE_UNREAD_MESSAGES,
                to: user.email,
                args: {
                    messageCount: `${messages.length}`,
                    text,
                }
            });
        } else if (messages.length === 1) {
            let senderId = messages[0].uid;
            let userProfile = await Modules.Users.profileById(ctx, senderId);

            await Modules.Email.enqueueEmail(ctx, {
                subject: 'You’ve got a new message',
                templateId: TEMPLATE_UNREAD_MESSAGE,
                to: user.email,
                args: {
                    firstName: userProfile!.firstName,
                    lastName: userProfile!.lastName || '',
                    messageCount: `${messages.length}`,
                }
            });
        }
    },
    async sendAccountActivatedEmail(parent: Context, oid: number, uid?: number) {
        await inTx(parent, async (ctx) => {
            let org = await Store.Organization.findById(ctx, oid);
            if (!org) {
                throw Error('Unable to find organization');
            }

            let orgProfile = await Store.OrganizationProfile.findById(ctx, oid);
            let members: number[] = [];

            if (uid) {
                members = [uid];
            } else {
                members = (await Store.OrganizationMember.organization.findAll(ctx, 'joined', oid)).map(m => m.uid);
            }

            for (let m of members) {
                let user = await loadUserState(ctx, m);
                await Modules.Email.enqueueEmail(ctx, {
                    subject: 'Organization account activated',
                    templateId: TEMPLATE_ACTIVATEED,
                    to: user.email,
                    args: {
                        'organizationName': orgProfile!.name,
                        ...(user.args)
                    }
                });
            }
        });
    },
    async sendAccountDeactivatedEmail(parent: Context, oid: number, uid?: number) {
        await inTx(parent, async (ctx) => {
            let org = await Store.Organization.findById(ctx, oid);
            if (!org) {
                throw Error('Unable to find organization');
            }
            let orgProfile = (await Store.OrganizationProfile.findById(ctx, oid))!;
            let members: number[] = [];

            if (uid) {
                members = [uid];
            } else {
                members = (await Store.OrganizationMember.organization.findAll(ctx, 'joined', oid)).map(m => m.uid);
            }

            for (let m of members) {
                let user = await loadUserState(ctx, m);
                await Modules.Email.enqueueEmail(ctx, {
                    subject: 'Organization account deactivated',
                    templateId: TEMPLATE_DEACTIVATED,
                    to: user.email,
                    args: {
                        'organizationName': orgProfile.name,
                        ...(user.args)
                    }
                });
            }
        });
    },

    async sendMemberRemovedEmail(parent: Context, oid: number, uid: number) {
        await inTx(parent, async (ctx) => {
            let org = await Store.Organization.findById(ctx, oid);
            if (!org) {
                throw Error('Unable to find organization');
            }

            let orgProfile = (await Store.OrganizationProfile.findById(ctx, oid))!;
            let user = await loadUserState(ctx, uid);

            await Modules.Email.enqueueEmail(ctx, {
                subject: `You were removed from ${orgProfile.name!}`,
                templateId: TEMPLATE_MEMBER_REMOVED,
                to: user.email,
                args: {
                    'organizationName': orgProfile.name!!,
                    ...(user.args)
                }
            });
        });
    },
    async sendMembershipLevelChangedEmail(parent: Context, oid: number, uid: number) {
        await inTx(parent, async (ctx) => {
            let org = await Store.Organization.findById(ctx, oid);
            if (!org) {
                throw Error('Unable to find organization');
            }

            let member = await Modules.Orgs.findUserMembership(ctx, uid, oid);

            if (!member) {
                throw Error('Unable to find organization');
            }

            let levelName = member.role === 'admin' ? 'admin' : 'member';

            let user = await loadUserState(ctx, uid);

            let orgProfile = (await Store.OrganizationProfile.findById(ctx, oid))!;

            await Modules.Email.enqueueEmail(ctx, {
                subject: `Your role at ${orgProfile.name!} was updated`,
                templateId: TEMPLATE_MEMBERSHIP_LEVEL_CHANGED,
                to: user.email,
                args: {
                    levelName,
                    organizationName: orgProfile.name!,
                    ...(user.args)
                }
            });
        });
    },
    async sendInviteEmail(parent: Context, oid: number, invite: OrganizationInviteLink) {
        await inTx(parent, async (ctx) => {
            let org = await Store.Organization.findById(ctx, oid);
            if (!org) {
                throw Error('Unable to find organization');
            }

            let userWelcome = {
                'userWelcome': invite.firstName ? 'Hi, ' + invite.firstName : 'Hi',
                'userName': [invite.firstName, invite.lastName].filter((v) => v).join(' '),
                'userFirstName': invite.firstName || '',
                'userLastName': invite.lastName || ''
            };

            let profile = await Modules.Users.profileById(ctx, invite.uid);

            if (!profile) {
                throw Error('Internal inconsistency');
            }

            let domain = process.env.APP_ENVIRONMENT === 'production' ? 'https://openland.com/join/' : 'http://localhost:3000/join/';
            let orgProfile = (await Store.OrganizationProfile.findById(ctx, oid))!;
            let avatar = await genAvatar(ctx, invite.uid);

            await Modules.Email.enqueueEmail(ctx, {
                subject: `Join ${orgProfile.name!} at Openland`,
                templateId: TEMPLATE_INVITE,
                to: invite.email,
                args: {
                    ...userWelcome,
                    firstName: profile.firstName || '',
                    lastName: profile.lastName || '',
                    customText: invite.text || '',
                    inviteLink: domain + invite.id,
                    link: domain + invite.id,
                    organizationName: orgProfile.name!!,
                    avatar
                }
            });
        });
    },

    async sendMemberJoinedEmails(parent: Context, oid: number, memberId: number, uid?: number, debug: boolean = false) {
        await inTx(parent, async (ctx) => {
            let org = await Store.Organization.findById(ctx, oid);
            if (!org) {
                throw Error('Unable to find organization');
            }

            let memberProfile = await Modules.Users.profileById(ctx, memberId);

            if (!memberProfile) {
                throw Error('Internal inconsistency');
            }

            let members: number[] = [];

            if (uid) {
                members = [uid];
            } else {
                members = (await Modules.Orgs.findOrganizationMembers(ctx, oid)).map(m => m.id);
            }

            let orgProfile = (await Store.OrganizationProfile.findById(ctx, oid))!;
            for (let member of members) {
                if (member === memberId && !debug) {
                    continue;
                }
                let user = await loadUserState(ctx, member);

                await Modules.Email.enqueueEmail(ctx, {
                    subject: 'Invitation accepted',
                    templateId: TEMPLATE_MEMBER_JOINED,
                    to: user.email,
                    args: {
                        ...(user.args),
                        memberName: memberProfile.firstName || '',
                        firstName: memberProfile.firstName || '',
                        lastName: memberProfile.lastName || '',
                        link: 'https://openland.com/mail/' + IDs.User.serialize(memberId),
                        'organizationName': orgProfile.name!!,
                    }
                });
            }
        });
    },
    async sendDebugEmail(ctx: Context, email: string, text: string) {
        await Modules.Email.enqueueEmail(ctx, {
            subject: 'Debug email',
            templateId: TEMPLATE_INVITE,
            to: email,
            args: {
                customText: text || '',
                inviteLink: 'http://test.com/',
                'organizationName': 'Debug',
                'userWelcome': 'hello'
            }
        });
    },
    async sendActivationCodeEmail(ctx: Context, email: string, code: string, existingAccount: boolean) {
        await Modules.Email.enqueueEmail(ctx, {
            subject: `Activation code: ` + code,
            templateId: existingAccount ? TEMPLATE_SIGIN_CODE : TEMPLATE_SIGNUP_CODE,
            to: email,
            args: {
                code
            }
        });
    },
    async sendRoomInviteEmail(ctx: Context, uid: number, email: string, roomId: number, invite: ChannelInvitation) {
        let avatar = await genAvatar(ctx, uid);
        let room = await Store.ConversationRoom.findById(ctx, roomId);
        let roomProfile = await Store.RoomProfile.findById(ctx, roomId);
        let roomTitle = await Modules.Messaging.room.resolveConversationTitle(ctx, roomId, uid);
        let userProfile = await Modules.Users.profileById(ctx, uid);

        let org = userProfile!.primaryOrganization ? await Store.OrganizationProfile.findById(ctx, userProfile!.primaryOrganization!) : null;
        let domain = process.env.APP_ENVIRONMENT === 'production' ? 'https://openland.com/joinChannel/' : 'http://localhost:3000/joinChannel/';

        await Modules.Email.enqueueEmail(ctx, {
            subject: `Join ${roomTitle} room at Openland`,
            templateId: room!.kind === 'public' ? TEMPLATE_ROOM_INVITE : TEMPLATE_PRIVATE_ROOM_INVITE,
            to: email,
            args: {
                link: domain + invite.id,
                avatar,
                roomDescription: roomProfile!.description || '',
                firstName: userProfile!.firstName,
                lastName: userProfile!.lastName || '',
                organizationName: org ? org.name : '',
                roomName: roomTitle
            }
        });
    },
    async sendRoomInviteAcceptedEmail(ctx: Context, uid: number, invite: ChannelInvitation) {

        let inviteCreator = await Store.User.findById(ctx, invite.creatorId);
        if (!inviteCreator!.email) {
            return;
        }

        let avatar = await genAvatar(ctx, uid);
        let roomId = invite.channelId;
        let roomTitle = await Modules.Messaging.room.resolveConversationTitle(ctx, roomId, uid);
        let userProfile = await Modules.Users.profileById(ctx, uid);
        let userName = userProfile!.firstName + ' ' + (userProfile!.lastName ? userProfile!.lastName : '');

        await Modules.Email.enqueueEmail(ctx, {
            subject: `${userName} has accepted your invitation`,
            templateId: TEMPLATE_ROOM_INVITE_ACCEPTED,
            to: inviteCreator!.email!,
            args: {
                link: `https://next.openland.com/mail/${IDs.User.serialize(uid)}`,
                avatar: avatar,
                firstName: userProfile!.firstName,
                lastName: userProfile!.lastName || '',
                roomName: roomTitle
            }
        });
    },
    async sendUnreadComments(ctx: Context, uid: number, comments: Comment[]) {
        let user = await loadUserState(ctx, uid);

        if (comments.length > 1) {

            let userNames = new Set<string>();

            for (let comment of comments) {
                let userName = await Modules.Users.getUserFullName(ctx, comment.uid);
                userNames.add(`<strong>${userName}</strong>`);
            }

            let userNamesArr = [...userNames];

            let text = 'You have comments from ';

            text += userNamesArr.slice(0, 3).join(', ');

            if (userNamesArr.length > 3) {
                text += ` and ${userNamesArr.length - 3} more`;
            }

            text += '.';

            await Modules.Email.enqueueEmail(ctx, {
                subject: 'You’ve got new messages',
                templateId: TEMPLATE_UNREAD_COMMENTS,
                to: user.email,
                args: {
                    messageCount: `${comments.length}`,
                    text,
                }
            });
        } else if (comments.length === 1) {
            let senderId = comments[0].uid;
            let userProfile = await Modules.Users.profileById(ctx, senderId);

            await Modules.Email.enqueueEmail(ctx, {
                subject: 'You’ve got a new message',
                templateId: TEMPLATE_UNREAD_COMMENT,
                to: user.email,
                args: {
                    firstName: userProfile!.firstName,
                    lastName: userProfile!.lastName || '',
                    messageCount: `${comments.length}`,
                }
            });
        }
    },

    async sendWeeklyDigestEmail(ctx: Context, uid: number) {
        const user = await loadUserState(ctx, uid);

        const cid = isProd
            // openland news
            ? IDs.Conversation.parse('EQvPJ1LamRtJJ9ppVxDDs30Jzw')
            : IDs.Conversation.parse('Wr8D66l5plu52AmgYoBWuznRLX');

        const topPosts = await Modules.Stats.getTopPosts(ctx, uid, cid);

        const formatedTopPosts: FormatedTopPosts = {
            count: topPosts.length,
            items: topPosts.map(post => {
                const avatar = post.sender.avatar ? resizeUcarecdnImage(post.sender.avatar, { height: 48, width: 48 }) : '';
                const formated: FormatedTopPost = {
                    ...post,
                    // @ts-ignore
                    // TODO: extend types
                    spans: getFilledSpans(post.message, post.spans),
                    chatLink: `https://openland.com/mail/${post.chatId}`,
                    sender: {
                        ...post.sender,
                        avatar,
                        orgLink: `https://openland.com/${post.sender.orgId}`,
                        profileLink: `https://openland.com/${post.sender.id}`,
                    },
                };
                return formated;
            })
        };

        // ---

        const unreadGroups = await Modules.Stats.getUnreadGroupsByUserId(ctx, uid, DIGEST_FIRST_UNREAD_GROUPS);

        const moreChats = unreadGroups.unreadMoreGroupsCount > 0 ? [{
            color: '',
            firstTitleChar: '',
            previewImage: 'https://cdn.openland.com/shared/email/discovery_new_messages@2x.png',
            previewLink: 'https://openland.com/mail/',
            serializedId: '',
            subTitle: '',
            title: `+${unreadGroups.unreadMoreGroupsCount} chats`
        } as FormatedUnreadGroup] : [];

        const unreadGroupsSplitedByRows = splitEvery(2, [...unreadGroups.groups, ...moreChats]);
        const unreadMessages: FormatedUnreadGroups = {
            unreadMessagesCount: unreadGroups.unreadMessagesCount,
            unreadMoreGroupsCount: unreadGroups.unreadMoreGroupsCount,
            rows: unreadGroupsSplitedByRows.map(row => ({
                items: row.map(item => {
                    if (item.previewImage.includes('discovery_new_messages')) {
                        return item as FormatedUnreadGroup;
                    }

                    const previewImage = item.previewImage ? resizeUcarecdnImage(item.previewImage, { height: 80, width: 80 }) : '';
                    const color = getAvatarColorById(item.serializedId);
                    const formated: FormatedUnreadGroup = {
                        ...item,
                        subTitle: `${item.unreadCount} new messages`,
                        firstTitleChar: item.title ? item.title[0].toUpperCase() : '',
                        // if image is empty, color is used
                        previewImage,
                        color,
                        previewLink: `https://openland.com/mail/${item.serializedId}`,
                    };
                    return formated;
                })
            })),
        };

        // ---

        // TODO: is allowed to count once a day, not only week?
        const ONE_WEEK_BEFORE = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const now = Date.now();

        const trendingGroupsFlat = await Modules.Stats.getTrendingGroupsByMessages(ctx, ONE_WEEK_BEFORE, now, DIGEST_FIRST_TREND_GROUPS);
        const trendingGroupsSplitedByRows = splitEvery(2, trendingGroupsFlat.groups);

        const trendingGroups: FormatedTrendGroups = {
            rows: trendingGroupsSplitedByRows.map(row => ({
                items: row.map(item => {
                    const previewImage = item.previewImage ? resizeUcarecdnImage(item.previewImage, { height: 80, width: 80 }) : '';
                    const color = getAvatarColorById(item.serializedId);
                    const formated: FormatedTrendGroup = {
                        ...item,
                        subTitle: `+${item.messagesDelta} messages`,
                        firstTitleChar: item.title ? item.title[0].toUpperCase() : '',
                        // if image is empty, color is used
                        previewImage,
                        color,
                        previewLink: `https://openland.com/mail/${item.serializedId}`,
                    };
                    return formated;
                })
            })),
        };

        // ---

        // there's can't be unread messages, but trending groups always should be presented

        const today = new Date();
        // TODO: today, monthly

        const formatedDate = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        const subject = `Openland Digest · ${formatedDate}`;
        const title = `Weekly Digest`;

        const weeklyDigestTemplateData: WeeklyDigestTemplateData = {
            subject,
            title,
            date: formatedDate,
            topPosts: formatedTopPosts,

            unreadMessages,
            trendingGroups,
        };

        // console.dir(JSON.stringify({ weeklyDigestTemplateData }, null, 2));

        await Modules.Email.enqueueEmail(ctx, {
            subject,
            templateId: TEMPLATE_WEEKLY_DIGEST,
            to: user.email,
            dynamicTemplateData: weeklyDigestTemplateData
        });

    }
};

const AvatarColorsArr = [
    'linear-gradient(138deg, #ffb600, #ff8d00)',
    'linear-gradient(138deg, #ff655d, #ff3d33)',
    'linear-gradient(138deg, #59d23c, #21ac00)',
    'linear-gradient(138deg, #11b2ff, #1970ff)',
    'linear-gradient(138deg, #00d1d4, #00afc8)',
    'linear-gradient(138deg, #aa22ff, #8e00e6)'
];

function doSimpleHash(key: string): number {
    var h = 0, l = key.length, i = 0;
    if (l > 0) {
        while (i < l) {
            h = (h << 5) - h + key.charCodeAt(i++) | 0;
        }
    }
    return Math.abs(h);
}

function getAvatarColorById(id: string) {
    return AvatarColorsArr[Math.abs(doSimpleHash(id) % AvatarColorsArr.length)];
}

async function genAvatar(ctx: Context, uid: number) {
    let profile = await Modules.Users.profileById(ctx, uid);
    if (profile!.picture) {
        let url = `https://ucarecdn.com/${profile!.picture.uuid}/-/preview/100x100/`;
        return `<img style="display: inline-block; vertical-align: top; width: 26px; height: 26px; margin-top: 6px; border-radius: 13px; margin-right: 6px;" src="${url}" />`;
    } else {
        let name = profile!.firstName[0] + (profile!.lastName ? profile!.lastName![0] : '');
        let serializedId = IDs.User.serialize(uid);
        let color = getAvatarColorById(serializedId);
        return `<span style="display: inline-block; vertical-align: top; width: 26px; height: 26px; margin-top: 6px; border-radius: 13px; margin-right: 6px; background-image: ${color}; color: #ffffff; text-align: center; font-size: 11px; font-weight: 600; line-height: 26px;">${name}</span>`;
    }
}

function resizeUcarecdnImage(imageStr: string, newSize: { width: number; height: number }) {
    // ["https:", "", "ucarecdn.com", "25629a3c-1ebe-4d49-8560-9df3b92ade3a", "-", "resize", "80x80", ""]
    const [, , , ucareImageID] = imageStr.split('/');
    return `https://ucarecdn.com/${ucareImageID}/-/resize/${newSize.width}x${newSize.height}/`;
}
