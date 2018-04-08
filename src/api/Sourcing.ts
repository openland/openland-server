import { withAccount } from './utils/Resolvers';
import { Repos } from '../repositories';
import { Opportunity } from '../tables/Opportunity';
import { IDs } from './utils/IDs';

export const Resolver = {
    Opportunity: {
        id: (src: Opportunity) => IDs.Opportunities.serialize(src.id!!),
        priority: (src: Opportunity) => 'NORMAL',
        state: (src: Opportunity) => src.state,
        parcel: (src: Opportunity) => src.lot ? src.lot : src.getLot()
    },
    Query: {
        alphaOpportunities: withAccount<{ state: string, first: number, after?: string, page?: number }>((args, uid, orgId) => {
            return Repos.Opportunities.fetchConnection(orgId, args.first, args.state, args.after, args.page);
        })
    },
    Mutation: {
        aphaAddOpportunity: withAccount<{ parcelId: string }>((args, uid, orgId) => {
            return Repos.Opportunities.addOpportunity(orgId, IDs.Parcel.parse(args.parcelId));
        })
    }
};