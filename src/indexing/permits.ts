import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { UpdateReader } from '../modules/updateReader';
import { dateDiff } from '../utils/date_utils';

export function createPermitsIndexer(client: ES.Client) {
    let reader = new UpdateReader('permits_indexing_10', DB.Permit);
    reader.include([
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
    ]);
    reader.processor(async (data) => {
        let forIndexing = [];
        for (let p of data) {
            forIndexing.push({
                index: {
                    _index: 'permits',
                    _type: 'permit',
                    _id: p.id
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

            let netUnits: number = 0;
            if (p.existingUnits !== null && p.proposedUnits !== null) {
                netUnits = p.proposedUnits!! - p.existingUnits!!;
                // console.warn(`Net Units: ${netUnits} ${p.proposedUnits} ${p.existingUnits}`);
            } else if (p.existingUnits !== null) {
                if (p.permitType === 'demolitions') {
                    netUnits = -p.existingUnits!!;
                }
            } else if (p.proposedUnits !== null) {
                if (p.permitType === 'new_construction') {
                    netUnits = p.proposedUnits!!;
                }
            }

            let netStories: number = 0;
            if (p.existingStories !== null && p.proposedStories !== null) {
                netStories = p.proposedStories!! - p.existingStories!!;
            } else if (p.existingStories !== null) {
                if (p.permitType === 'demolitions') {
                    netStories = -p.existingStories!!;
                }
            } else if (p.proposedStories !== null) {
                if (p.permitType === 'new_construction') {
                    netStories = p.proposedStories!!;
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
                netUnits: netUnits,
                netStories: netStories,

                existingStories: p.existingStories,
                proposedStories: p.proposedStories,
                existingUnits: p.existingUnits,
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
                        permitCreated: { type: 'date' },
                        permitCompleted: { type: 'date' },
                        permitIssued: { type: 'date' },
                        approvalTime: { type: 'long' }
                    }
                }
            });
        } catch (e) {
            console.warn(e);
        }

        try {
            await client.bulk({
                body: forIndexing
            });
        } catch (e) {
            console.warn(e);
            throw e;
        }
    });

    return reader;
    // reader.start();
}