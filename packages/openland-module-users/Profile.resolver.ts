import { Store } from 'openland-module-db/FDB';
import { IDs } from 'openland-module-api/IDs';
import { Modules } from 'openland-modules/Modules';
import { validate, stringNotEmpty } from 'openland-utils/NewInputValidator';
import { inTx } from '@openland/foundationdb';
import { Sanitizer } from 'openland-utils/Sanitizer';
import { withUser } from 'openland-module-api/Resolvers';
import { AccessDeniedError } from 'openland-errors/AccessDeniedError';
import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { AppContext } from 'openland-modules/AppContext';
import { UserProfile } from 'openland-module-db/store';

export default {
    Profile: {
        id: (src: UserProfile) => IDs.Profile.serialize(src.id!!),
        firstName: (src: UserProfile) => src.firstName,
        lastName: (src: UserProfile) => src.lastName,
        photoRef: (src: UserProfile) => src.picture,
        email: (src: UserProfile) => src.email,
        phone: (src: UserProfile) => src.phone,
        website: (src: UserProfile) => src.website,
        about: (src: UserProfile) => src.about,
        location: (src: UserProfile) => src.location,
        linkedin: (src: UserProfile) => src.linkedin,
        instagram: (src: UserProfile) => src.instagram,
        twitter: (src: UserProfile) => src.twitter,
        facebook: (src: UserProfile) => src.facebook,
        primaryBadge: (src: UserProfile, args: {}, ctx: AppContext) => src.primaryBadge ? Store.UserBadge.findById(ctx, src.primaryBadge) : null,

        alphaRole: (src: UserProfile) => src.role,
        alphaLocations: (src: UserProfile) => src.locations,
        alphaLinkedin: (src: UserProfile) => src.linkedin,
        alphaTwitter: (src: UserProfile) => src.twitter,
        alphaJoinedAt: (src: UserProfile) => src.metadata.createdAt + '',
        alphaInvitedBy: async (src: UserProfile, args: {}, ctx: AppContext) => {
            let user = await Store.User.findById(ctx, src.id);
            if (user && user.invitedBy) {
                return await Store.User.findById(ctx, user.invitedBy);
            }
            return null;
        },
    },
    Query: {
        myProfile: async function (_obj: any, args: {}, ctx: AppContext) {
            if (ctx.auth.uid == null) {
                return null;
            }
            return await Modules.Users.profileById(ctx, ctx.auth.uid);
        },
    },
    Mutation: {
        profileCreate: withUser(async (ctx, args, uid) => {
            return await Modules.Users.createUserProfile(ctx, uid, args.input);
        }),
        profileUpdate: withUser(async (parent, args, uid) => {
            return await inTx(parent, async (ctx) => {
                if (args.uid) {
                    let role = await Modules.Super.superRole(ctx, uid);
                    if (!(role === 'super-admin')) {
                        throw new AccessDeniedError();
                    }
                    uid = IDs.User.parse(args.uid);
                }
                let user = await Store.User.findById(ctx, uid);
                if (!user) {
                    throw Error('Unable to find user');
                }
                let profile = await Modules.Users.profileById(ctx, uid);
                if (!profile) {
                    throw Error('Unable to find profile');
                }
                if (args.input.firstName !== undefined) {
                    await validate(
                        stringNotEmpty('Please enter your first name'),
                        args.input.firstName,
                        'input.firstName'
                    );
                    profile.firstName = Sanitizer.sanitizeString(args.input.firstName)!;
                }
                if (args.input.lastName !== undefined) {
                    profile.lastName = Sanitizer.sanitizeString(args.input.lastName);
                }
                if (args.input.location !== undefined) {
                    profile.location = Sanitizer.sanitizeString(args.input.location);
                }
                if (args.input.website !== undefined) {
                    profile.website = Sanitizer.sanitizeString(args.input.website);
                }
                if (args.input.about !== undefined) {
                    profile.about = Sanitizer.sanitizeString(args.input.about);
                    await Modules.Stats.onAboutChange(ctx, uid);
                }
                if (args.input.photoRef !== undefined) {
                    if (args.input.photoRef !== null) {
                        await Modules.Media.saveFile(ctx, args.input.photoRef.uuid);
                    }
                    profile.picture = Sanitizer.sanitizeImageRef(args.input.photoRef);
                }
                if (args.input.phone !== undefined) {
                    profile.phone = Sanitizer.sanitizeString(args.input.phone);
                }
                if (args.input.email !== undefined) {
                    profile.email = Sanitizer.sanitizeString(args.input.email);
                }

                if (args.input.linkedin !== undefined) {
                    profile.linkedin = Sanitizer.sanitizeString(args.input.linkedin);
                }

                if (args.input.instagram !== undefined) {
                    profile.instagram = Sanitizer.sanitizeString(args.input.instagram);
                }

                if (args.input.twitter !== undefined) {
                    profile.twitter = Sanitizer.sanitizeString(args.input.twitter);
                }

                if (args.input.facebook !== undefined) {
                    profile.facebook = Sanitizer.sanitizeString(args.input.facebook);
                }

                if (args.input.primaryOrganization) {
                    let oid = IDs.Organization.parse(args.input.primaryOrganization);
                    let org = await Store.Organization.findById(ctx, oid);
                    if (org && org.kind === 'organization') {
                        profile.primaryOrganization = IDs.Organization.parse(args.input.primaryOrganization);
                    }
                }
                await Modules.Hooks.onUserProfileUpdated(ctx, profile.id);
                await Modules.Users.markForUndexing(ctx, uid);
                return profile;
            });
        }),

        // Deprecated
        createProfile: withUser(async (ctx, args, uid) => {
            return await Modules.Users.createUserProfile(ctx, uid, args.input);
        }),
        // Deprecated
        alphaCreateUserProfileAndOrganization: withUser(async (parent, args, uid) => {
            return await inTx(parent, async (ctx) => {
                let userProfile = await Modules.Users.createUserProfile(ctx, uid, args.user);
                let organization = await Modules.Orgs.createOrganization(ctx, uid, { ...args.organization, personal: false });

                return {
                    user: userProfile,
                    organization: organization
                };
            });
        }),
        updateProfile: withUser(async (parent, args, uid) => {
            return await inTx(parent, async (ctx) => {
                if (args.uid) {
                    let role = await Modules.Super.superRole(ctx, uid);
                    if (!(role === 'super-admin')) {
                        throw new AccessDeniedError();
                    }
                    uid = IDs.User.parse(args.uid);
                }
                let user = await Store.User.findById(ctx, uid);
                if (!user) {
                    throw Error('Unable to find user');
                }

                let profile = await Modules.Users.profileById(ctx, uid);
                if (!profile) {
                    throw Error('Unable to find profile');
                }
                if (args.input.firstName !== undefined) {
                    await validate(
                        stringNotEmpty('Please enter your first name'),
                        args.input.firstName,
                        'input.firstName'
                    );
                    profile.firstName = Sanitizer.sanitizeString(args.input.firstName)!;
                }
                if (args.input.lastName !== undefined) {
                    profile.lastName = Sanitizer.sanitizeString(args.input.lastName);
                }
                if (args.input.location !== undefined) {
                    profile.location = Sanitizer.sanitizeString(args.input.location);
                }
                if (args.input.website !== undefined) {
                    profile.website = Sanitizer.sanitizeString(args.input.website);
                }
                if (args.input.about !== undefined) {
                    profile.about = Sanitizer.sanitizeString(args.input.about);
                    await Modules.Stats.onAboutChange(ctx, uid);
                }
                if (args.input.photoRef !== undefined) {
                    if (args.input.photoRef !== null) {
                        await Modules.Media.saveFile(ctx, args.input.photoRef.uuid);
                    }
                    profile.picture = Sanitizer.sanitizeImageRef(args.input.photoRef);
                }
                if (args.input.phone !== undefined) {
                    profile.phone = Sanitizer.sanitizeString(args.input.phone);
                }
                if (args.input.email !== undefined) {
                    profile.email = Sanitizer.sanitizeString(args.input.email);
                }

                if (args.input.alphaLocations !== undefined) {
                    profile.locations = Sanitizer.sanitizeAny(args.input.alphaLocations);
                }

                if (args.input.linkedin !== undefined) {
                    profile.linkedin = Sanitizer.sanitizeString(args.input.linkedin);
                }

                if (args.input.alphaLinkedin !== undefined) {
                    profile.linkedin = Sanitizer.sanitizeString(args.input.alphaLinkedin);
                }

                if (args.input.alphaTwitter !== undefined) {
                    profile.twitter = Sanitizer.sanitizeString(args.input.alphaTwitter);
                }

                if (args.input.alphaRole !== undefined) {
                    profile.role = Sanitizer.sanitizeString(args.input.alphaRole);
                }

                if (args.input.alphaPrimaryOrganizationId !== undefined) {
                    let oid = IDs.Organization.parse(args.input.alphaPrimaryOrganizationId!);
                    let org = await Store.Organization.findById(ctx, oid);
                    if (org && org.kind === 'organization') {
                        profile.primaryOrganization = oid;
                    }
                }

                // Call hook
                await profile.flush(ctx);
                await Modules.Hooks.onUserProfileUpdated(ctx, profile.id);
                await Modules.Users.markForUndexing(ctx, uid);

                return Modules.Users.profileById(ctx, uid);
            });
        }),
    }
} as GQLResolver;