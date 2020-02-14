import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withUser } from 'openland-module-api/Resolvers';
import { generateVideo } from './generateVideo';

export const Resolver: GQLResolver = {
    Mutation: {
        alphaRenderVideo: withUser(async (ctx, args, uid) => {
            return await generateVideo(args.name, {});
        })
    }
};
