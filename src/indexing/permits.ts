import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { updateReader } from '../modules/updateReader';
import { dateDiff } from '../utils/date_utils';

export function startPermitsIndexer(client: ES.Client) {
    updateReader('permits_indexing_4', DB.Permit, [
        {
            model: DB.StreetNumber,
            as: 'streetNumbers',
            include: [{
                model: DB.Street,
                as: 'street',
                include: [{
                    model: DB.City,
                    as: 'city',
                    include: [{
                        model: DB.County,
                        as: 'county',
                        include: [{
                            model: DB.State,
                            as: 'state'
                        }]
                    }]
                }]
            }]
        }
    ], async (data) => {
        let forIndexing = [];
        for (let p of data) {
            forIndexing.push({
                index: {
                    _index: 'permits',
                    _type: 'permit',
                    _id: p.id,
                }
            });

            let address = p.streetNumbers!!.map((v) => {
                let res = `${v.number}`;
                if (v.suffix) {
                    res += v.suffix;
                }
                res += ' ' + v.street!!.name + ' ' + v.street!!.suffix;
                return res;
            }).join();

            let approvalTime: number | null = null;
            if (p.permitCreated && p.permitIssued) {
                approvalTime = dateDiff(new Date(p.permitCreated), new Date(p.permitIssued));

                // Hot Fix for wrong data
                if (approvalTime < 0) {
                    approvalTime = null;
                }
            }

            forIndexing.push({
                permitId: p.permitId,
                account: p.account,

                permitType: p.permitType,
                permitTypeWood: p.permitTypeWood,
                permitStatus: p.permitStatus,
                permitStatusUpdated: p.permitStatusUpdated,

                permitCreated: p.permitCreated,
                permitIssued: p.permitIssued,
                permitExpired: p.permitExpired,
                permitExpires: p.permitExpires,
                permitStarted: p.permitStarted,
                permitFiled: p.permitFiled,
                permitCompleted: p.permitCompleted,

                approvalTime: approvalTime,

                existingStories: p.existingStories,
                proposedStories: p.proposedStories,
                existingUnits: p.existingStories,
                proposedUnits: p.proposedUnits,
                existingAffordableUnits: p.existingAffordableUnits,
                proposedAffordableUnits: p.proposedAffordableUnits,
                proposedUse: p.proposedUse,
                description: p.description,
                addresses: p.streetNumbers!!.map((v) => ({
                    streetNumber: v.number,
                    streetNumberSuffix: v.suffix,
                    street: v.street!!.name,
                    streetSuffix: v.street!!.suffix,
                    city: v.street!!.city!!.name,
                    county: v.street!!.city!!.county!!.name,
                    stateCode: v.street!!.city!!.county!!.state!!.code,
                    state: v.street!!.city!!.county!!.state!!.name,
                })),
                address: address
            });
        }

        try {
            await client.indices.putMapping({
                index: 'permits', type: 'permit', body: {
                    properties: {
                        permitCreated: {type: 'date'},
                        permitCompleted: {type: 'date'},
                        permitIssued: {type: 'date'},
                        approvalTime: {type: 'long'}
                    }
                }
            });
        } catch (e) {
            console.warn(e);
        }

        await client.bulk({
            body: forIndexing
        });
    });
}