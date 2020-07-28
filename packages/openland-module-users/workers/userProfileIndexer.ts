import { Store } from 'openland-module-db/FDB';
import { declareSearchIndexer } from 'openland-module-search/declareSearchIndexer';
import { Modules } from 'openland-modules/Modules';
import { inTx } from '@openland/foundationdb';

let hashtagRegex = /#[\w]+/g;

export function userProfileIndexer() {
    declareSearchIndexer({
        name: 'user-profile-index',
        version: 23,
        index: 'user_profile',
        stream: Store.UserIndexingQueue.updated.stream({ batchSize: 50 })
    }).withProperties({
        primaryOrganization: {
            type: 'keyword'
        },
        organizations: {
            type: 'keyword'
        },
        chats: {
            type: 'keyword'
        },
        firstName: {
            type: 'text'
        },
        lastName: {
            type: 'text'
        },
        shortName: {
            type: 'text'
        },
        name: {
            type: 'text'
        },
        ivitedBy: {
            type: 'long'
        },
        ivitedByName: {
            type: 'text'
        },
        status: {
            type: 'text'
        },
        userId: {
            type: 'long'
        },
        createdAt: {
            type: 'date'
        },
        updatedAt: {
            type: 'date'
        },
        search: {
            type: 'text'
        },
        about: {
            type: 'text',
            analyzer: 'hashtag'
        }
    }).withSettings({
        analysis: {
            char_filter: {
                space_hashtags: {
                    type: 'mapping',
                    mappings: ['#=>|#']
                }
            },
            filter: {
                hashtag_as_alphanum: {
                    type: 'word_delimiter',
                    type_table: ['# => ALPHANUM', '@ => ALPHANUM', '_ => ALPHANUM']
                }
            },
            analyzer: {
                hashtag: {
                    type: 'custom',
                    char_filter: 'space_hashtags',
                    tokenizer: 'whitespace',
                    filter: ['lowercase', 'hashtag_as_alphanum']
                }
            }
        }
    })
        .start(async (item, parent) => {
        return await inTx(parent, async (ctx) => {
            let profile = (await Store.UserProfile.findById(ctx, item.id));

            if (!profile) {
                return null;
            }

            let shortName = await Modules.Shortnames.findShortnameByOwner(ctx, 'user', item.id);
            let orgs = await Modules.Orgs.findUserOrganizations(ctx, item.id);

            let searchData: (string | undefined | null)[] = [];
            searchData.push(profile.firstName);
            searchData.push(profile.lastName);
            searchData.push(shortName ? shortName.shortname : undefined);
            searchData.push(profile.email);

            let invitedByName: string | undefined;
            let user = await Store.User.findById(ctx, item.id);
            if (user && user.invitedBy) {
                let inviter = await Store.UserProfile.findById(ctx, user.invitedBy);
                if (inviter) {
                    invitedByName = (inviter.firstName || '') + ' ' + (inviter.lastName || '');
                }
            }

            let about = '';
            if (profile.about) {
                let m = profile.about.match(hashtagRegex);
                if (m) {
                    about = m.join(' ');
                }
            }
            let chats = (await Store.RoomParticipant.userActive.findAll(ctx, item.id)).map(p => p.cid);

            return {
                id: item.id!!,
                doc: {
                    firstName: profile.firstName,
                    lastName: profile.lastName || undefined,
                    name: (profile.firstName || '') + ' ' + (profile.lastName || ''),
                    shortName: shortName ? shortName.shortname : undefined,
                    userId: item.id,
                    search: searchData.join(' '),
                    about: about,
                    primaryOrganization: profile.primaryOrganization || undefined,
                    organizations: orgs,
                    chats: chats,
                    ivitedBy: user ? (user.invitedBy || undefined) : undefined,
                    letInvitedByName: invitedByName,
                    ivitedByName: invitedByName,
                    status: user!.status,
                    createdAt: item.metadata.createdAt,
                    updatedAt: item.metadata.updatedAt,
                }
            };
        });
    });
}
