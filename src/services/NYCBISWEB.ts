import { CacheRepository } from '../repositories/CacheRepository';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { delay } from '../utils/timer';

export interface BisBlockInformation {
    borough: number;
    block: number;
    lots: BisLot[];
}
export interface BisLot {
    lot: number;
    bins: number[];
}

async function fetchBis(borough: number, block: number, next?: string): Promise<{ lots: { lot: number, bin: number }[], next?: string, errored: boolean }> {
    let lots: { lot: number, bin: number }[] = [];
    let fnext: string | undefined = undefined;
    let errored = false;
    let url = 'http://a810-bisweb.nyc.gov/bisweb/PropertyBrowseByBBLServlet?requestid=1&allborough=' + borough + '&allblock=' + block;
    if (next) {
        url = url + '&allcount=' + next;
    }
    let res = await fetch(url, { timeout: 10000 });
    if (res.ok) {
        let text = await res.text();
        let data = cheerio.load(text);
        let rows = cheerio(data('table').get(3)).find('tr').toArray();
        fnext = data('form[name="frmnext"]').children('input[name="allcount"]').val();
        for (let i = 1; i < rows.length; i++) {
            let cols = cheerio(rows[i]).find('td').toArray();
            let lotId = parseInt(cheerio(cols[0]).text(), 10);
            let binId = parseInt(cheerio(cols[cols.length - 1]).text(), 10);
            lots.push({ lot: lotId, bin: binId });
        }
    } else {
        errored = true;
    }

    return { lots, next: fnext, errored };
}

export class NYCBISWEB {
    private cache = new CacheRepository<BisBlockInformation>('nyc_bis_web');
    async fetchBlock(borough: number, block: number): Promise<BisBlockInformation> {
        let key = `${borough}-${block}`;
        let cached = await this.cache.read(key);
        if (cached) {
            return cached;
        }

        // Loading data
        let lots = new Map<number, Set<number>>();
        let res = await fetchBis(borough, block);
        if (res.errored) {
            return { borough, block, lots: [] };
        }
        for (let r of res.lots) {
            if (!lots.has(r.lot)) {
                lots.set(r.lot, new Set());
            }
            lots.get(r.lot)!!.add(r.bin);
        }
        let next = res.next;
        while (next) {
            let res2 = await fetchBis(borough, block, next);
            if (res2.errored) {
                return { borough, block, lots: [] };
            }
            for (let r of res2.lots) {
                if (!lots.has(r.lot)) {
                    lots.set(r.lot, new Set());
                }
                lots.get(r.lot)!!.add(r.bin);
            }
            next = res2.next;
            await delay(100);
        }

        // Merging result
        let lotsRes: { lot: number, bins: number[] }[] = [];
        for (let k of lots.keys()) {
            let v = lots.get(k)!!;
            lotsRes.push({ lot: k, bins: [...v] });
        }

        // Caching result
        await this.cache.write(key, { borough, block, lots: lotsRes });

        // Return result
        return { borough, block, lots: lotsRes };
    }
}