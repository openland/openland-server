import { withAccount } from './utils/Resolvers';
import { DB } from '../tables';
import { Deal } from '../tables/Deal';
import { IDs } from './utils/IDs';

interface DealInput {
    title: string;
    status?: 'ACTIVE' | 'CLOSED' | 'ON_HOLD';
    statusDescription?: string;
    statusDate?: string;

    location?: string;
    address?: string;

    parcels?: [string];
}

export const Resolver = {
    Deal: {
        id: (src: Deal) => IDs.Deal.serialize(src.id!!),
        title: (src: Deal) => src.title,
        status: (src: Deal) => src.status,
        statusDescription: (src: Deal) => src.statusDescription,
        statusDate: (src: Deal) => src.statusDate,

        location: (src: Deal) => src.location,
        address: (src: Deal) => src.address,
    },
    Query: {
        deals: withAccount((args, uid, org) => {
            return DB.Deal.findAll({ where: { organizationId: org } });
        }),
        deal: withAccount<{ id: string }>(async (args, uid, org) => {
            let deal = await DB.Deal.findById(IDs.Deal.parse(args.id));
            if (deal === null) {
                throw Error('Unable to find deal');
            }
            if (deal.organizationId !== org) {
                throw Error('Unable to find deal');
            }
            return deal;
        })
    },
    Mutation: {
        dealAdd: withAccount<{ input: DealInput }>((args, uid, org) => {
            return DB.Deal.create({
                title: args.input.title,
                status: args.input.status,
                statusDescription: args.input.statusDescription,
                statusDate: args.input.statusDate,
                location: args.input.location,
                address: args.input.address,
                organizationId: org
            });
        })
    }
};