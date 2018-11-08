import { FDB } from 'openland-module-db/FDB';
import { withAccount } from 'openland-module-api/Resolvers';
import { Modules } from 'openland-modules/Modules';
import { Message } from 'openland-module-db/schema';

export default {
    Query: {
        alphaChatTextSearch: withAccount<{ query: string }>(async (args, uid, oid) => {

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
            let orgsConvs = await Promise.all((await Modules.Orgs.findUserOrganizations(uid)).map(o => FDB.ConversationOrganization.findFromOrganization(o)));
            let oganizationsConversations = (await Promise.all(orgsConvs.filter(oc => !!oc).map(oc => oc!).map(oc => FDB.Conversation.findById(oc.id)))).filter(oc => !!oc).map(oc => oc!);

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
            for (let c of res) {
                let msg = await FDB.Message.rangeFromChat(c.id, 1, true);
                if (msg.length === 0) {
                    messages.set(c.id, null);
                } else {
                    messages.set(c.id, msg[0]);
                }
            }
            res = res.filter(c => messages.get(c.id))
                .sort((a, b) => {
                    let lastMessageA = messages.get(a.id);
                    let lastMessageB = messages.get(b.id);
                    return (lastMessageB ? new Date((lastMessageB as any).createdAt).getTime() : 0) - (lastMessageA ? new Date((lastMessageA as any).createdAt).getTime() : 0);
                });
            return res;

        }),
    }
};