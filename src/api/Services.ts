import { withAny } from './utils/Resolvers';
import { Services } from '../services';

export const Resolvers = {
    Query: {
        servicesNYCProperties: withAny<{ borough: number, block: number, lot: number }>(async (args) => {
            return Services.NYCProperties.fetchPropertyInformation(args.borough, args.block, args.lot);
        }),
        servicesNYCBisWeb: withAny<{ borough: number, block: number }>(async (args) => {
            return Services.NYCBisWeb.fetchBlock(args.borough, args.block);
        })
    }
};