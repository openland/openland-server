import { DB, City, County, State } from '../tables/index';
import * as DataLoader from 'dataloader';

export class AreaRepository {
    private cityLoader = new DataLoader<number, City | null>(async (cities) => {
        let foundTokens = await DB.City.findAll({
            where: {
                id: {
                    $in: cities
                }
            }
        });
        let res: (City | null)[] = [];
        for (let i of cities) {
            let found = false;
            for (let f of foundTokens) {
                if (i === f.id) {
                    res.push(f);
                    found = true;
                    break;
                }
            }
            if (!found) {
                res.push(null);
            }
        }
        return res;
    });
    private countyLoader = new DataLoader<number, County | null>(async (cities) => {
        let foundTokens = await DB.County.findAll({
            where: {
                id: {
                    $in: cities
                }
            }
        });
        let res: (County | null)[] = [];
        for (let i of cities) {
            let found = false;
            for (let f of foundTokens) {
                if (i === f.id) {
                    res.push(f);
                    found = true;
                    break;
                }
            }
            if (!found) {
                res.push(null);
            }
        }
        return res;
    });
    private stateLoader = new DataLoader<number, State | null>(async (cities) => {
        let foundTokens = await DB.State.findAll({
            where: {
                id: {
                    $in: cities
                }
            }
        });
        let res: (State | null)[] = [];
        for (let i of cities) {
            let found = false;
            for (let f of foundTokens) {
                if (i === f.id) {
                    res.push(f);
                    found = true;
                    break;
                }
            }
            if (!found) {
                res.push(null);
            }
        }
        return res;
    });
    private cache = new Map<string, number | null>();
    async resolveArea(domain: string): Promise<{ id: number, slug: string }> {
        domain = domain.toLocaleLowerCase();
        if (this.cache.has(domain)) {
            let r = this.cache.get(domain);
            if (r !== null && r !== undefined) {
                return { id: r, slug: domain };
            } else {
                throw Error('Unknown area ' + domain);
            }
        } else {
            let account = await DB.Account.findOne({ where: { slug: domain } });
            if (account !== null) {
                this.cache.set(domain, account.id!!);
                return { id: account.id!!, slug: domain };
            } else {
                this.cache.set(domain, null);
                throw Error('Unknown area ' + domain);
            }
        }
    }

    async resolveCity(state: string, county: string, city: string) {
        let res = await DB.City.findOne({
            where: {
                name: city
            },
            include: [{
                model: DB.County,
                as: 'county',
                where: {
                    name: county
                },
                include: [{
                    model: DB.State,
                    as: 'state',
                    where: {
                        code: state
                    }
                }]
            }]
        });
        if (!res) {
            throw 'City is not found for ' + state + ', ' + county + ', ' + city;
        }
        return res.id!!;
    }

    async resolveCityInfo(id: number) {
        return await this.cityLoader.load(id);
    }
    async resolveCountyInfo(id: number) {
        return await this.countyLoader.load(id);
    }
    async resolveStateInfo(id: number) {
        return await this.stateLoader.load(id);
    }
}