import { withAccount } from './utils/Resolvers';
import { Repos } from '../repositories';
import { Opportunity } from '../tables/Opportunity';
import { IDs } from './utils/IDs';
import * as Turf from '@turf/turf';

type OpportunitySort = 'DATE_ADDED_DESC' | 'AREA_ASC' | 'AREA_DESC';

export const Resolver = {
    Opportunity: {
        id: (src: Opportunity) => IDs.Opportunities.serialize(src.id!!),
        priority: (src: Opportunity) => 'NORMAL',
        state: (src: Opportunity) => src.state,
        parcel: (src: Opportunity) => src.lot ? src.lot : src.getLot(),
        geometry: (src: Opportunity) => src.lot ? src.lot!!.geometry : src.getLot().then((v) => v!!.geometry),
        center: async (src: Opportunity) => {
            let lot = src.lot ? src.lot : (await src.getLot())!!;
            if (lot && lot.geometry) {
                let ctr = Turf.centerOfMass({ type: 'MultiPolygon', coordinates: lot.geometry.polygons.map((v) => [v.coordinates.map((v2) => [v2.longitude, v2.latitude])]) });
                return { longitude: ctr.geometry!!.coordinates[0], latitude: ctr.geometry!!.coordinates[1] };
            }
            return null;
        },
        updatedAt: (src: Opportunity) => (src as any).updatedAt
    },
    Query: {
        alphaOpportunity: withAccount<{ id: string }>((args, uid, orgId) => {
            return Repos.Opportunities.findOpportunityById(orgId, IDs.Opportunities.parse(args.id));
        }),
        alphaOpportunities: withAccount<{ state: string, sort: OpportunitySort | null, first: number, after?: string, page?: number }>((args, uid, orgId) => {
            return Repos.Opportunities.fetchConnection(orgId, args.sort, args.first, args.state, args.after, args.page);
        }),
        alphaOpportunitiesCount: withAccount<{ state: string }>((args, uid, orgId) => {
            return Repos.Opportunities.fetchConnectionCount(orgId, args.state);
        }),
        alphaNextReviewOpportunity: withAccount<{ state: string, sort: OpportunitySort | null, initialId?: string }>((args, uid, orgId) => {
            let initId: number | undefined;
            if (args.initialId) {
                initId = IDs.Opportunities.parse(args.initialId);
            }
            return Repos.Opportunities.fetchNext(orgId, args.state, args.sort, initId);
        }),
        alphaOpportunityOverlay: withAccount<{ box: { south: number, north: number, east: number, west: number }, limit: number }>((args, uid, orgId) => {
            return Repos.Opportunities.fetchGeoOpportunities(orgId, args.box, args.limit);
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