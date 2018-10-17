import { DB } from '../tables';
import { bulkApply } from '../utils/db_utils';
import { IncidentAttributes, IncidentCategory } from '../tables/Incidents';

interface IncindentInput {
    id?: string | null;
    incidentNumber?: string | null;
    location?: { latitude: number, longitude: number } | null;
    category?: string | null;
    description?: string | null;
    date?: string | null;
    resolution?: string | null;
    address?: string | null;
}

export class IncidentsRepository {
    applyData = async (areaId: number, src: IncindentInput[]) => {

        //     id?: number;
        // account?: number;
        // incidentNumber?: string;
        // category?: IncidentCategory;
        // description?: string;
        // date?: string;
        // resolution?: string;
        // address?: string;
        // geo?: Geo;
        // importId?: string;

        let updated: IncidentAttributes[] = src.map((v) => ({
            importId: v.id,
            incidentNumber: v.incidentNumber,
            category: v.category ? v.category.toLocaleLowerCase() as IncidentCategory : undefined,
            description: v.description,
            date: v.date,
            resolution: v.resolution,
            address: v.address,
        }));
        let updated2: IncidentAttributes[] = src.map((v) => ({
            importId: v.id,
            geo: v.location
        }));

        await DB.tx(async (tx) => {
            await bulkApply(tx, DB.Incident, areaId, 'importId', updated);
            await bulkApply(tx, DB.Incident, areaId, 'importId', updated2);
        });
    }

}