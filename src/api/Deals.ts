import { withAccount } from './utils/Resolvers';
import { DB } from '../tables';
import { Deal } from '../tables/Deal';
import { IDs } from './utils/IDs';

export const Resolver = {
    Deal: {
        id: (src: Deal) => IDs.Deal.serialize(src.id!!),
        title: (src: Deal) => src.title,
    },
    Query: {
        deals: withAccount((args, uid, org) => {
            return DB.Deal.findAll({ where: { organizationId: org } });
        })
    },
    Mutation: {
        dealAdd: withAccount<{ input: { title: string } }>((args, uid, org) => {
            console.warn(org);
            return DB.Deal.create({
                title: args.input.title,
                organizationId: org
            });
        })
    }
};