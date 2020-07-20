import { GQL, GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { IDs } from '../../openland-module-api/IDs';
import { GQLRoots } from '../../openland-module-api/schema/SchemaRoots';
import ContactsUpdateRoot = GQLRoots.ContactsUpdateRoot;
import { ContactAddedEvent, ContactRemovedEvent } from '../../openland-module-db/store';
import { Store } from '../../openland-module-db/FDB';
import { Context } from '@openland/context';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';

export const Resolver: GQLResolver = {
    ContactsUpdateContainer: {
        updates: src => src.items,
        state: src => IDs.ContactsUpdatesCursor.serialize(src.cursor || '')
    },
    ContactsUpdate: {
        __resolveType(src: ContactsUpdateRoot) {
            if (src instanceof ContactAddedEvent) {
                return 'ContactAdded';
            } else if (src instanceof ContactRemovedEvent) {
                return 'ContactRemoved';
            } else {
                throw new Error('unknown contacts update: ' + src);
            }
        }
    },
    ContactAdded: {
        contact: async (src, _, ctx) => (await Store.Contact.findById(ctx, src.uid, src.contactUid))!
    },
    ContactRemoved: {
        contact: async (src, _, ctx) => (await Store.Contact.findById(ctx, src.uid, src.contactUid))!
    },

    Subscription: {
        myContactsUpdates: {
            resolve: (msg: any) => msg,
            subscribe: async function (r: any, args: GQL.SubscriptionMyContactsUpdatesArgs, ctx: Context) {
                let uid = ctx.auth.uid;
                if (!uid) {
                    throw new AccessDeniedError();
                }
                let userCursor: undefined|string;
                if (args.fromState) {
                    userCursor = IDs.ContactsUpdatesCursor.parse(args.fromState);
                }
                return Store.UserContactsEventStore.createLiveStream(ctx, uid, { batchSize: 50, after: userCursor });
            }
        }
    }
};