import { Store } from 'openland-module-db/FDB';
import { withAccount } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { createTracer } from 'openland-log/createTracer';
import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { isDefined } from '../../openland-utils/misc';

const tracer = createTracer('chat-text-search');

export const Resolver: GQLResolver = {
    Query: {
        alphaChatTextSearch: withAccount(async (parent, args, uid, oid) => {
            return await tracer.trace(parent, 'chat-text-search', async (ctx) => {
                // Group Search
                // let searchableConversations = Promise.all((await FDB.RoomParticipant.allFromUserActive(uid))
                //     .map((v) => FDB.Conversation.findById(v.cid)));
                // let groupsChannels = (await Promise.all((await searchableConversations)
                //     .map((v) => v && FDB.RoomProfile.findById(v.id))))
                //     .filter((v) => v && v.title.toLocaleLowerCase().indexOf(args.query.toLowerCase()) >= 0)
                //     .map((v) => v!);

                let conversations = Modules.Messaging.search
                    .searchForRooms(ctx, args.query, { uid, limit: 20 })
                    .then((r) => r.map((v) => Store.Conversation.findById(ctx, v)));

                // PERSONAL - search users first, then matching conversations with current user
                let personal = Modules.Users.searchForUsers(ctx, args.query, { uid, limit: 20 })
                    .then((r) => r.uids.map((v) => Modules.Messaging.room.resolvePrivateChat(ctx, uid, v)));

                // Organizations chats
                // let matchingUserOrgProfiles = (await Promise.all((await Modules.Orgs.findUserOrganizations(uid)).map(uoid => FDB.OrganizationProfile.findById(uoid)))).filter(oc => !!oc && oc.name.toLocaleLowerCase().indexOf(args.query.toLowerCase()) >= 0).map(oc => oc!);
                // let orgConv = (await Promise.all(matchingUserOrgProfiles.map(oc => FDB.ConversationOrganization.findFromOrganization(oc.id)))).filter(oc => !!oc).map(oc => oc!);
                // let oganizationsConversations = (await Promise.all(orgConv.map(oc => FDB.Conversation.findById(oc.id)))).filter(oc => !!oc).map(oc => oc!);

                let res = [...await Promise.all(await conversations), ...await Promise.all((await personal))].filter(isDefined);
                res = res.filter((v) => !!v).reduce(
                    (p, x) => {
                        if (!p.find(c => c.id === x!.id)) {
                            p.push(x);
                        }
                        return p;
                    },
                    [] as any[]
                );
                // let messages = new Map<number, Message | null>();

                // let topMesges = await Promise.all(res.map(c => FDB.Message.rangeFromChat(c.id, 1, true)));
                // for (let tmsgs of topMesges) {
                //     let msg = tmsgs[0];
                //     if (msg) {
                //         messages.set(msg.cid, msg);
                //     }
                // }
                // res = res.filter(c => messages.get(c.id))
                //     .sort((a, b) => {
                //         let lastMessageA = messages.get(a.id);
                //         let lastMessageB = messages.get(b.id);
                //         return (lastMessageB ? new Date((lastMessageB as any).createdAt).getTime() : 0) - (lastMessageA ? new Date((lastMessageA as any).createdAt).getTime() : 0);
                //     });
                return res;
            });
        }),
        betaDialogTextSearch: withAccount(async (parent, args, uid, oid) => {
            return await tracer.trace(parent, 'chat-text-search', async (ctx) => {

                let conversations = Modules.Messaging.search
                    .searchForRooms(ctx, args.query, { uid, limit: 20 })
                    .then((r) => r.map((v) => Store.Conversation.findById(ctx, v)));

                // PERSONAL - search users first, then matching conversations with current user
                let personal = Modules.Users.searchForUsers(ctx, args.query, { uid, limit: 20 })
                    .then((r) => r.uids.map((v) => Modules.Messaging.room.resolvePrivateChat(ctx, uid, v)));

                let res = [...await Promise.all(await conversations), ...await Promise.all((await personal))];
                res = res.filter((v) => !!v).reduce(
                    (p, x) => {
                        if (!p.find(c => c.id === x!.id)) {
                            p.push(x);
                        }
                        return p;
                    },
                    [] as any[]
                );

                return res.filter(isDefined).map(d => d!).map(r => ({ cid: r.id }));
            });
        }),
    }
};
