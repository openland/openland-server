import * as ES from 'elasticsearch';
import { DB } from '../tables';
import { delay } from '../utils/timer';
import { Permit } from '../tables/Permit';
import { tryLock } from '../modules/locking';
import { readReaderOffset, writeReaderOffset } from '../modules/readerState';

export async function enableIndexer() {
    console.warn('Starting Elastic Search Indexing (' + process.env.ELASTIC_ENDPOINT + ')');
    let client = new ES.Client({
        host: process.env.ELASTIC_ENDPOINT
    });

    while (true) {
        let res = await DB.connection.transaction(async (tx) => {

            //
            // Prerequisites
            //

            if (!(await tryLock(tx, 'permits_indexing'))) {
                return false;
            }

            let offset = await readReaderOffset(tx, 'permits_indexing');

            //
            // Loading Pending Permits
            //

            console.log('Loading Updated Permits');

            let permits: Permit[] = (await DB.Permit.findAll({
                order: [['updatedAt', 'ASC'], ['id', 'ASC']],
                where: (offset ? {
                    updatedAt: {
                        $gt: offset
                    }
                } : {}),
                limit: 100,
                transaction: tx
            }));
            if (permits.length <= 0) {
                return false;
            }

            //
            // Prepare Data
            //

            let forIndexing = [];
            for (let p of permits) {
                forIndexing.push({
                    index: {
                        _index: 'permits',
                        _type: 'permit',
                        _id: p.id,
                    }
                });
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

                    existingStories: p.existingStories,
                    proposedStories: p.proposedStories,
                    existingUnits: p.existingStories,
                    proposedUnits: p.proposedUnits,
                    existingAffordableUnits: p.existingAffordableUnits,
                    proposedAffordableUnits: p.proposedAffordableUnits,
                    proposedUse: p.proposedUse,
                    description: p.description
                });
            }

            //
            // Committing
            //

            console.log(`Indexing Updated Permits (${permits.length})`);

            let indexing = client.bulk({
                body: forIndexing
            });
            let commit = writeReaderOffset(tx, 'permits_indexing',
                new Date(permits[permits.length - 1].updatedAt!!));

            await indexing;
            await commit;

            console.log('Completed Indexing');
            return true;
        });
        if (res) {
            await delay(100);
        } else {
            await delay(1000);
        }
    }
}