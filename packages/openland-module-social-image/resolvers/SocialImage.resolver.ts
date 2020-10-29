import { GQLResolver } from '../../openland-module-api/schema/SchemaSpec';
import { Modules } from '../../openland-modules/Modules';
import { buildBaseImageUrl } from '../../openland-module-media/ImageRef';
import { withConverationId } from '../../openland-module-messaging/resolvers/Room.resolver';
import { withUser } from '../../openland-module-users/User.resolver';

export const Resolver: GQLResolver = {
    SharedRoom: {
        externalSocialImage: withConverationId(async (ctx, cid) => {
            let image = await Modules.SocialImageModule.getRoomSocialImage(ctx, cid);
            return image ? buildBaseImageUrl(image) : null;
        })
    },
    User: {
        externalSocialImage: withUser(async (ctx, user) => {
            let image = await Modules.SocialImageModule.getUserSocialImage(ctx, user.id);
            return image ? buildBaseImageUrl(image) : null;
        }, true)
    },
    Organization: {
        externalSocialImage: async (org, args, ctx) => {
            let image = await Modules.SocialImageModule.getOrganizationSocialImage(ctx, org.id);
            return image ? buildBaseImageUrl(image) : null;
        }
    }
};