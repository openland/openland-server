import { DB } from '../tables/index';
import { SelectBuilder } from '../modules/SelectBuilder';

export class OpportunitiesRepository {
    fetchConnection(organization: number, first: number, after?: string, page?: number) {
        let builder = new SelectBuilder(DB.Opportunities)
            .limit(first)
            .after(after)
            .page(page)
            .whereEq('organizationId', organization);
        return builder.findAll();
    }
}