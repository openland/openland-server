import { withAccount } from 'openland-module-api/Resolvers';
import { IdsFactory, IDs } from 'openland-module-api/IDs';
import { Modules } from 'openland-modules/Modules';
import { IDMailformedError } from 'openland-errors/IDMailformedError';
import { FDB } from 'openland-module-db/FDB';
import { Conversation, RoomProfile } from 'openland-module-db/schema';
import { CallContext } from 'openland-module-api/CallContext';
import { AccessDeniedError } from 'openland-errors/AccessDeniedError';

type RoomRoot = Conversation | number;

function withConverationId(handler: (src: number, context: CallContext) => any) {
    return async (src: RoomRoot, args: {}, context: CallContext) => {
        if (typeof src === 'number') {
            return handler(src, context);
        } else {
            return handler(src.id, context);
        }
    };
}

function withRoomProfile(handler: (src: RoomProfile) => any) {
    return async (src: RoomRoot) => {
        if (typeof src === 'number') {
            return handler((await FDB.RoomProfile.findById(src))!);
        } else {
            return handler((await FDB.RoomProfile.findById(src.id))!);
        }
    };
}

export default {
    Room: {
        __resolveType: async (src: Conversation | number) => {
            let conv: Conversation;
            if (typeof src === 'number') {
                conv = (await FDB.Conversation.findById(src))!;
            } else {
                conv = src;
            }
            if (conv.kind === 'private') {
                return 'PrivateRoom';
            } else {
                return 'SharedRoom';
            }
        }
    },
    PrivateRoom: {
        id: (root: RoomRoot) => IDs.Room.serialize(typeof root === 'number' ? root : root.id),
        user: async (root: RoomRoot, args: {}, context: CallContext) => {
            let proom = (await FDB.ConversationPrivate.findById(typeof root === 'number' ? root : root.id))!;
            if (proom.uid1 === context.uid!) {
                return proom.uid2;
            } else if (proom.uid2 === context.uid!) {
                return proom.uid1;
            } else {
                throw new AccessDeniedError();
            }
        }
    },
    SharedRoom: {
        id: (root: RoomRoot) => IDs.Room.serialize(typeof root === 'number' ? root : root.id),
        kind: withConverationId(async (id) => {
            let room = (await FDB.ConversationRoom.findById(id))!;
            if (room.kind === 'group') {
                return 'GROUP';
            } else if (room.kind === 'internal') {
                return 'INTERNAL';
            } else if (room.kind === 'public') {
                return 'PUBLIC';
            } else if (room.kind === 'organization') {
                return 'INTERNAL';
            } else {
                throw Error('Unknown room kind: ' + room.kind);
            }
        }),
        title: withConverationId(async (id, context) => Modules.Messaging.room.resolveConversationTitle(id, context.uid!)),
        photo: withConverationId(async (id, context) => Modules.Messaging.room.resolveConversationPhoto(id, context.uid!)),
        organization: async (root: RoomRoot) => {
            //
        },

        description: withRoomProfile((profile) => {
            return profile.description;
        }),

        membership: async (root: RoomRoot) => {
            //
        },
        membersCount: async (root: RoomRoot) => {
            //
        }
    },
    Query: {
        room: withAccount<{ id: string }>(async (args, uid, oid) => {
            let id = IdsFactory.resolve(args.id);
            if (id.type === IDs.Conversation) {
                return id.id;
            } else if (id.type === IDs.User) {
                return Modules.Messaging.room.resolvePrivateChat(id.id, uid);
            } else if (id.type === IDs.Organization) {
                let member = await FDB.OrganizationMember.findById(id.id, uid);
                if (!member || member.status !== 'joined') {
                    throw new IDMailformedError('Invalid id');
                }
                return Modules.Messaging.room.resolveOrganizationChat(id.id);
            } else {
                throw new IDMailformedError('Invalid id');
            }
        })
    }
};