import { FDB } from 'openland-module-db/FDB';
import { withAccount } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { Message } from 'openland-module-db/schema';
import { createTracer } from 'openland-log/createTracer';
import { withTracing } from 'openland-log/withTracing';

const tracer = createTracer('chat-text-search');

export default {
    Query: {
        alphaChatTextSearch: withAccount<{ query: string }>(async (args, uid, oid) => {
            return await withTracing(tracer, 'chat-text-search', async () => {
                // GROUPS / CHANNELS has titles we can search 
                let searchableConversations = Promise.all((await FDB.UserDialog.allFromUser(uid)).map((v) => FDB.Conversation.findById(v.cid)));

                let groupsChannels = (await Promise.all((await searchableConversations)
                    .filter((v) => v!.kind === 'room')
                    .map((v) => FDB.RoomProfile.findById(v!.id))))
                    .filter((v) => v!.title.toLocaleLowerCase().indexOf(args.query.toLowerCase()) >= 0)
                    .map((v) => v!);

                // PERSONAL - search users first, then matching conversations with current user
                let personal = Promise.all((
                    await Modules.Users.searchForUsers(args.query, { uid, limit: 50 })).map((v) => Modules.Messaging.conv.resolvePrivateChat(uid, v)));

                // Organizations chats
                let matchingUserOrgProfiles = (await Promise.all((await Modules.Orgs.findUserOrganizations(uid)).map(uoid => FDB.OrganizationProfile.findById(uoid)))).filter(oc => !!oc && oc.name.toLocaleLowerCase().indexOf(args.query.toLowerCase()) >= 0).map(oc => oc!);
                let orgConv = (await Promise.all(matchingUserOrgProfiles.map(oc => FDB.ConversationOrganization.findFromOrganization(oc.id)))).filter(oc => !!oc).map(oc => oc!);
                let oganizationsConversations = (await Promise.all(orgConv.map(oc => FDB.Conversation.findById(oc.id)))).filter(oc => !!oc).map(oc => oc!);

                let res = [...await personal, ...await groupsChannels, ...oganizationsConversations];
                res = res.reduce(
                    (p, x) => {
                        if (!p.find(c => c.id === x.id)) {
                            p.push(x);
                        }
                        return p;
                    },
                    [] as any[]
                );
                let messages = new Map<number, Message | null>();

                let topMesges = await Promise.all(res.map(c => FDB.Message.rangeFromChat(c.id, 1, true)));
                for (let tmsgs of topMesges) {
                    let msg = tmsgs[0];
                    if (msg) {
                        messages.set(msg.cid, msg);
                    }
                }
                res = res.filter(c => messages.get(c.id))
                    .sort((a, b) => {
                        let lastMessageA = messages.get(a.id);
                        let lastMessageB = messages.get(b.id);
                        return (lastMessageB ? new Date((lastMessageB as any).createdAt).getTime() : 0) - (lastMessageA ? new Date((lastMessageA as any).createdAt).getTime() : 0);
                    });
                return res;
            });
        }),
    }
};