import { withAccount } from './utils/Resolvers';
import { DB } from '../tables';
import { Deal } from '../tables/Deal';
import { IDs } from './utils/IDs';
import { normalizeDate } from '../modules/Normalizer';

interface DealInput {
    title?: string | null;
    status?: 'ACTIVE' | 'CLOSED' | 'ON_HOLD' | null;
    statusDescription?: string | null;
    statusDate?: string | null;

    location?: string | null;
    address?: string | null;
}

export const Resolver = {
    Deal: {
        id: (src: Deal) => IDs.Deal.serialize(src.id!!),
        title: (src: Deal) => src.title,
        status: (src: Deal) => src.status,
        statusDescription: (src: Deal) => src.statusDescription,
        statusDate: (src: Deal) => normalizeDate(src.statusDate),

        location: (src: Deal) => src.location,
        address: (src: Deal) => src.address,
    },
    Query: {
        deals: withAccount((args, uid, org) => {
            return DB.Deal.findAll({ where: { organizationId: org }, order: [['createdAt', 'ASC']] });
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
            if (!args.input.title) {
                throw Error('Title is required');
            }
            return DB.Deal.create({
                title: args.input.title!!,
                status: args.input.status,
                statusDescription: args.input.statusDescription,
                statusDate: normalizeDate(args.input.statusDate),
                location: args.input.location,
                address: args.input.address,
                organizationId: org
            });
        }),
        dealAlter: withAccount<{ id: string, input: DealInput }>(async (args, uid, org) => {
            let id = IDs.Deal.parse(args.id);
            let existing = await DB.Deal.find({ where: { organizationId: org, id: id } });
            if (!existing) {
                throw Error('Unable to find deal');
            }

            if (args.input.title !== undefined && args.input.title !== null) {
                existing.title = args.input.title;
            }

            if (args.input.location !== undefined) {
                existing.location = args.input.location;
            }
            if (args.input.address !== undefined) {
                existing.address = args.input.address;
            }

            if (args.input.status !== undefined) {
                existing.status = args.input.status;
            }
            if (args.input.statusDescription !== undefined) {
                existing.statusDescription = args.input.statusDescription;
            }
            if (args.input.statusDate !== undefined) {
                existing.statusDate = args.input.statusDate;
            }

            await existing.save();

            return existing;
        })
    }
};