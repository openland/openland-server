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

    price?: number | null;

    extrasArea?: number | null;
    extrasCompany?: string | null;
    extrasAttorney?: string | null;
    extrasReferee?: string | null;

    extrasLotShape: string | null;
    extrasLotSize: string | null;
    extrasTaxBill: number | null;
}

// price?: number | null;
// area?: number | null;
// company?: string | null;
// attrorney?: string | null;
// referee?: string | null;

// lotShape?: string | null;
// lotSize?: string | null;

// taxBill?: number | null;

export const Resolver = {
    Deal: {
        id: (src: Deal) => IDs.Deal.serialize(src.id!!),
        title: (src: Deal) => src.title,
        status: (src: Deal) => src.status,
        statusDescription: (src: Deal) => src.statusDescription,
        statusDate: (src: Deal) => normalizeDate(src.statusDate),
        location: (src: Deal) => src.location,
        address: (src: Deal) => src.address,
        price: (src: Deal) => src.price,
        extrasArea: (src: Deal) => src.area,
        extrasCompany: (src: Deal) => src.company,
        extrasAttorney: (src: Deal) => src.attorney,
        extrasReferee: (src: Deal) => src.referee,
        extrasLotShape: (src: Deal) => src.lotShape,
        extrasLotSize: (src: Deal) => src.lotSize,
        extrasTaxBill: (src: Deal) => src.taxBill,
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
        dealRemove: withAccount<{ id: string }>(async (args, uid, org) => {
            let id = IDs.Deal.parse(args.id);
            await DB.Deal.destroy({ where: { organizationId: org, id: id } });
            return 'ok';
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

            if (args.input.price !== undefined) {
                existing.price = args.input.price;
            }

            if (args.input.extrasArea !== undefined) {
                existing.area = args.input.extrasArea;
            }

            if (args.input.extrasCompany !== undefined) {
                existing.company = args.input.extrasCompany;
            }

            if (args.input.extrasAttorney !== undefined) {
                existing.attorney = args.input.extrasAttorney;
            }

            if (args.input.extrasReferee !== undefined) {
                existing.referee = args.input.extrasReferee;
            }

            if (args.input.extrasLotShape !== undefined) {
                existing.lotShape = args.input.extrasLotShape;
            }

            if (args.input.extrasLotSize !== undefined) {
                existing.lotSize = args.input.extrasLotSize;
            }

            if (args.input.extrasTaxBill !== undefined) {
                existing.taxBill = args.input.extrasTaxBill;
            }

            await existing.save();

            return existing;
        })
    }
};