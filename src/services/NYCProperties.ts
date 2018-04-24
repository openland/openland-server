import { CacheRepository } from '../repositories/CacheRepository';
import fetch from 'node-fetch';
import * as qs from 'query-string';
import * as cheerio from 'cheerio';
export interface PropertyInformation {
    borough: number;
    block: number;
    lot: number;
    owners: string[];
}

export class NYCProperties {
    private cache = new CacheRepository<PropertyInformation>('nyc_properties');

    async fetchPropertyInformation(borough: number, block: number, lot: number) {
        let key = `${borough}-${block}-${lot}`;
        let existing = await this.cache.read(key);
        if (existing) {
            return existing;
        }

        let resp: PropertyInformation = {
            borough: borough,
            block: block,
            lot: lot,
            owners: []
        };

        try {
            // Fetch
            let res = await fetch('http://webapps.nyc.gov:8084/CICS/fin1/find001i', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: qs.stringify({
                    'FFUNC': 'C',
                    'FBORO': `${borough}`,
                    'FBLOCK': `${block}`,
                    'FLOT': `${lot}`,
                    'FEASE': ''
                }),
                timeout: 5000
            });

            // Process
            if (res.ok) {
                let text = await res.text();
                let data = cheerio.load(text);
                let bboro = parseInt(data('input[name="q49_boro"]').first().val(), 10);
                let bblock = parseInt(data('input[name="q49_block_id"]').first().val(), 10);
                let blot = parseInt(data('input[name="q49_lot"]').first().val(), 10);
                let owners = data('input[name="ownerName1"], input[name="ownerName2"], input[name="ownerName3"], input[name="ownerName4"]')
                    .toArray()
                    .map((v) => (v.attribs.value as string).trim())
                    .filter((v) => v.length > 0);

                // Check input and handle response
                if (bboro === borough && bblock === block && blot === lot) {
                    resp.owners = owners;
                    await this.cache.write(key, resp);
                }
            } else {
                // Ignoring errors
            }
        } catch (e) {
            // Ignoring errors
        }

        return resp;
    }
}