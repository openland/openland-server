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
        alphaOpportunity: withAccount<{ id: string }>((args, uid, orgId) => {
            return Repos.Opportunities.findOpportunityById(orgId, IDs.Opportunities.parse(args.id));
        }),
        alphaOpportunities: withAccount<{ state: string, first: number, after?: string, page?: number }>((args, uid, orgId) => {
            return Repos.Opportunities.fetchConnection(orgId, args.first, args.state, args.after, args.page);
        }),
        alphaOpportunitiesCount: withAccount<{ state: string }>((args, uid, orgId) => {
            return Repos.Opportunities.fetchConnectionCount(orgId, args.state);
        }),
        alphaNextReviewOpportunity: withAccount<{ state: string }>((args, uid, orgId) => {
            return Repos.Opportunities.fetchNext(orgId, args.state);
        })
    },
    Mutation: {
        alphaApprove: withAccount<{ opportunityId: string, state: string }>((args, uid, orgId) => {
            return Repos.Opportunities.approveOpportunity(orgId, IDs.Opportunities.parse(args.opportunityId), args.state);
        }),
        alphaReject: withAccount<{ opportunityId: string, state: string }>((args, uid, orgId) => {
            return Repos.Opportunities.rejectOpportunity(orgId, IDs.Opportunities.parse(args.opportunityId), args.state);
        }),
        alphaSnooze: withAccount<{ opportunityId: string, state: string }>((args, uid, orgId) => {
            return Repos.Opportunities.snoozeOpportunity(orgId, IDs.Opportunities.parse(args.opportunityId), args.state);
        }),
        aphaAddOpportunity: withAccount<{ parcelId: string }>((args, uid, orgId) => {
            return Repos.Opportunities.addOpportunity(orgId, IDs.Parcel.parse(args.parcelId));
        }),
        alphaAddOpportunitiesFromSearch: withAccount<{ state: string, county: string, city: string, query: string }>(async (args, uid, orgId) => {
            let cityid = await Repos.Area.resolveCity(args.state, args.county, args.city);
            let parcels = await Repos.Parcels.fetchAllParcels(cityid, args.query);
            await Repos.Opportunities.addOpportunityBatch(orgId, parcels);
            return parcels.length;
        })
    }
};