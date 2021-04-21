import {
    boolean,
    entity,
    enumString,
    field,
    integer, json,
    optional,
    primaryKey, rangeIndex,
    string, struct, union, uniqueIndex
} from '@openland/foundationdb-compiler';

export function usersStore() {
    //
    // User
    //

    entity('User', () => {
        primaryKey('id', integer());

        // supposed to be unique auth id ( 'email|some@email.com', 'google|$user_id$' )
        // but over time many junk records was made ( like bare google $user_id$, etc. )
        // so authId is considered to be deprecated and now contains random unique uuid
        field('authId', string());
        field('email', optional(string()));
        field('googleId', optional(string()));
        field('phone', optional(string()));

        field('isBot', boolean());
        field('invitedBy', optional(integer()));
        field('botOwner', optional(integer()));
        field('isSuperBot', optional(boolean()));
        field('status', enumString('pending', 'activated', 'suspended', 'deleted'));

        uniqueIndex('authId', ['authId']).withCondition(src => src.status !== 'deleted');
        uniqueIndex('email', ['email']).withCondition(src => (!!src.email) && src.status !== 'deleted');
        uniqueIndex('googleId', ['googleId']).withCondition(src => (!!src.googleId) && src.status !== 'deleted');
        uniqueIndex('fromPhone', ['phone']).withCondition(src => (!!src.phone) && src.status !== 'deleted');
        // deprecated
        // uniqueIndex('phone', ['phone']).withCondition(src => (!!src.googleId) && src.status !== 'deleted');
        rangeIndex('owner', ['botOwner', 'id']).withCondition(src => src.botOwner);
        rangeIndex('superBots', []).withCondition(src => src.isBot === true && src.isSuperBot);
        rangeIndex('created', ['createdAt']);
    });

    entity('UserProfile', () => {
        primaryKey('id', integer());
        field('firstName', string());
        field('lastName', optional(string()));
        field('phone', optional(string()));
        field('about', optional(string()));
        field('website', optional(string()));
        field('location', optional(string()));
        field('email', optional(string()));
        field('picture', optional(json()));
        field('twitter', optional(string()));
        field('facebook', optional(string()));
        field('linkedin', optional(string()));
        field('instagram', optional(string()));
        field('locations', optional(json()));
        field('primaryOrganization', optional(integer()));
        field('primaryBadge', optional(integer()));
        field('role', optional(string()));
        field('birthDay', optional(integer()));
        field('status', optional(string()));
        field('modernStatus', optional(union({
            custom: struct({
                emoji: optional(string()),
                text: string()
            }),
            badge: struct({
                id: integer()
            })
        })));
        rangeIndex('byUpdatedAt', ['updatedAt']);
        rangeIndex('created', ['createdAt']);
    });

    entity('UserProfilePrefil', () => {
        primaryKey('id', integer());
        field('firstName', optional(string()));
        field('lastName', optional(string()));
        field('picture', optional(string()));
    });

    //
    //  Apps versioning
    //
    entity('AppRelease', () => {
        primaryKey('platform', string()); // ios | android
        primaryKey('id', integer());
        field('version', string());
        field('releaseNotes', optional(string()));
        field('releaseDate', integer());

        rangeIndex('platform', ['platform', 'id']);
    });
}