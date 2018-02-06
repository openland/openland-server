import { Repos } from '../repositories/index';

export const Schema = `

    enum IncidentCategory {
        ROBBERY
        ASSAULT
        SECONDARY_CODES
        NON_CRIMINAL
        VANDALISM
        BUrGLARY
        LARCENY
        DRUG
        WARRANTS
        VEHICLE_THEFT
        OTHER_OFFENSES
        WEAPON_LAWS
        ARSON
        MISSING_PERSON
        DRIVING_UNDER_THE_INFLUENCE
        SUSPICIOUS_OCC
        RECOVERED_VEHICLE
        DRUNKENNESS
        TRESPASS
        FRAUD
        DISORDERLY_CONDUCT
        SEX_OFFENSES_FORCIBLE
        SEX_OFFENSES_NON_FORCIBLE
        COUNTERFEITING
        KIDNAPPING
        EMBEZZLEMENT
        STOLEN_PROPERTY
        LIQUOR_LAWS
        FAMILY_OFFENSES
        LOITERING
        BAD_CHECKS
        TREA
        GAMBLING
        RUNAWAY
        BRIBERY
        PROSTITUTION
        PORNOGRAPHY
        SUICIDE
        EXTORTION
    }

    type Incident {
        id: ID!
        incidentNumber: String
        location: Geo
        category: IncidentCategory
        description: String
        date: String
        resolution: String
        address: String
    }

    input IncidentInput {
        id: ID!
        incidentNumber: String
        location: GeoInput
        category: IncidentCategory
        description: String
        date: String
        resolution: String
        address: String
    }

    extend type Mutation {
        updateIncidents(area: String!, incidents: [IncidentInput!]!): String!
    }
`;

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