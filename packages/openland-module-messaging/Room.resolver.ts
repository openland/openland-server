import { withAccount } from 'openland-module-api/Resolvers';
import { IdsFactory, IDs } from 'openland-module-api/IDs';
import { Modules } from 'openland-modules/Modules';
import { IDMailformedError } from 'openland-errors/IDMailformedError';
import { FDB } from 'openland-module-db/FDB';
import { Conversation } from 'openland-module-db/schema';
import { CallContext } from 'openland-module-api/CallContext';
import { AccessDeniedError } from 'openland-errors/AccessDeniedError';

type RoomRoot = Conversation | number;

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
    },
    Query: {
        room: withAccount<{ id: string }>(async (args, uid, oid) => {
            let id = IdsFactory.resolve(args.id);
            if (id.type === IDs.Conversation) {
                return id.id;
            } else if (id.type === IDs.User) {
                return Modules.Messaging.conv.resolvePrivateChat(id.id, uid);
            } else if (id.type === IDs.Organization) {
                let member = await FDB.OrganizationMember.findById(id.id, uid);
                if (!member || member.status !== 'joined') {
                    throw new IDMailformedError('Invalid id');
                }
                return Modules.Messaging.conv.resolveOrganizationChat(id.id);
            } else {
                throw new IDMailformedError('Invalid id');
            }
        })
    }
};