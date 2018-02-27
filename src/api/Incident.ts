import { Repos } from '../repositories/index';

interface IncindentInput {
    id: string;
    incidentNumber?: string | null;
    location?: { latitude: number, longitude: number };
    category?: string | null;
    description?: string | null;
    date?: string | null;
    resolution?: string | null;
    address?: string | null;
}

export const Resolvers = {
    Mutation: {
        updateIncidents: async (_: any, args: { area: string, incidents: IncindentInput[] }) => {
            let area = await Repos.Area.resolveArea(args.area);
            await Repos.Incidents.applyData(area.id, args.incidents);
            return 'ok';
        }
    }
};