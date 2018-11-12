import { FDB } from 'openland-module-db/FDB';
import { IDs } from 'openland-module-api/IDs';
import { UserProfile } from 'openland-module-db/schema';
import { Modules } from 'openland-modules/Modules';
import { CallContext } from 'openland-module-api/CallContext';
import { validate, stringNotEmpty } from 'openland-utils/NewInputValidator';
import { inTx } from 'foundation-orm/inTx';
import { Sanitizer } from 'openland-utils/Sanitizer';
import { withUser } from 'openland-module-api/Resolvers';
import { AccessDeniedError } from 'openland-errors/AccessDeniedError';
import { GQL } from '../openland-module-api/schema/SchemaSpec';

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
        twitter: (src: UserProfile) => src.twitter,

        alphaRole: (src: UserProfile) => src.role,
        alphaLocations: (src: UserProfile) => src.locations,
        alphaLinkedin: (src: UserProfile) => src.linkedin,
        alphaTwitter: (src: UserProfile) => src.twitter,
        alphaJoinedAt: (src: UserProfile) => src.createdAt,
        alphaInvitedBy: async (src: UserProfile) => {
            let user = await FDB.User.findById(src.id);
            if (user && user.invitedBy) {
                return await FDB.User.findById(user.invitedBy);
            }
            return null;
        },
    },
    Query: {
        myProfile: async function (_obj: any, _params: {}, context: CallContext) {
            if (context.uid == null) {
                return null;
            }
            return Modules.Users.profileById(context.uid);
        },
    },
    Mutation: {
        profileCreate: withUser<GQL.MutationProfileCreateArgs>(async (args, uid) => {
            return await Modules.Users.createUserProfile(uid, args.input);
        }),
        profileUpdate: withUser<GQL.MutationProfileUpdateArgs>(async (args, uid) => {
            return await inTx(async () => {
                if (args.uid) {
                    let role = await Modules.Super.superRole(uid);
                    if (!(role === 'super-admin')) {
                        throw new AccessDeniedError();
                    }
                    uid = IDs.User.parse(args.uid);
                }
                let user = await FDB.User.findById(uid);
                if (!user) {
                    throw Error('Unable to find user');
                }
                await inTx(async () => {
                    let profile = await Modules.Users.profileById(uid);
                    if (!profile) {
                        throw Error('Unable to find profile');
                    }
                    if (args.input.firstName !== undefined) {
                        await validate(
                            stringNotEmpty('First name can\'t be empty!'),
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
                    }
                    if (args.input.photoRef !== undefined) {
                        if (args.input.photoRef !== null) {
                            await Modules.Media.saveFile(args.input.photoRef.uuid);
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

                    if (args.input.twitter !== undefined) {
                        profile.twitter = Sanitizer.sanitizeString(args.input.twitter);
                    }

                    if (args.input.primaryOrganization) {
                        profile.primaryOrganization = IDs.Organization.parse(args.input.primaryOrganization);
                    }
                });
                return user;
            });
        }),

        // Deprecated
        createProfile: withUser<GQL.MutationCreateProfileArgs>(async (args, uid) => {
            return await Modules.Users.createUserProfile(uid, args.input);
        }),
        // Deprecated
        alphaCreateUserProfileAndOrganization: withUser<GQL.MutationAlphaCreateUserProfileAndOrganizationArgs>(async (args, uid) => {
            return await inTx(async () => {
                let userProfile = await Modules.Users.createUserProfile(uid, args.user);
                let organization = await Modules.Orgs.createOrganization(uid, { ...args.organization, personal: false });

                return {
                    user: userProfile,
                    organization: organization
                };
            });
        }),
        updateProfile: withUser<GQL.MutationUpdateProfileArgs>(async (args, uid) => {
            return await inTx(async () => {
                if (args.uid) {
                    let role = await Modules.Super.superRole(uid);
                    if (!(role === 'super-admin')) {
                        throw new AccessDeniedError();
                    }
                    uid = IDs.User.parse(args.uid);
                }
                let user = await FDB.User.findById(uid);
                if (!user) {
                    throw Error('Unable to find user');
                }
                await inTx(async () => {
                    let profile = await Modules.Users.profileById(uid);
                    if (!profile) {
                        throw Error('Unable to find profile');
                    }
                    if (args.input.firstName !== undefined) {
                        await validate(
                            stringNotEmpty('First name can\'t be empty!'),
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
                    }
                    if (args.input.photoRef !== undefined) {
                        if (args.input.photoRef !== null) {
                            await Modules.Media.saveFile(args.input.photoRef.uuid);
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
                        profile.primaryOrganization = IDs.Organization.parse(args.input.alphaPrimaryOrganizationId!);
                    }
                });
                return user;
            });
        }),
    }
};