import { WorkQueue } from '../modules/workerQueue';
import { DB } from '../tables';
import { Resolver as Parcel } from '../api/Parcels';
import { JsonMap, JsonArray } from '../utils/json';

let parcelNumberFormat = (parcel: {
    id: {
        borough?: string,
        boroughId?: number,
        block?: number,
        blockPadded?: string,
        lot?: number,
        lotPadded?: string,
        title?: string | number | boolean | JsonMap | JsonArray | null,
    }
}) => {
    if (parcel.id.borough && parcel.id.block && parcel.id.lot) {
        return parcel.id.boroughId + '-' + (parcel.id.blockPadded || parcel.id.block + '-' + parcel.id.lotPadded || parcel.id.lot);
    } else if (parcel.id.block && parcel.id.lot) {
        return (parcel.id.blockPadded || parcel.id.block) + ' - ' + (parcel.id.lotPadded || parcel.id.lot);
    } else {
        return parcel.id.title;
    }
};

export function createExportWorker() {
    let queue = new WorkQueue<{ folderId: number }, { downloadLink: string }>('exportFolderTask');
    queue.addWorker(async (item) => {

        let items = await DB.FolderItem.findAll({
            where: {
                folderId: item.folderId
            },
            include: [{
                model: DB.Lot,
                as: 'lot',
                where: {
                    retired: false,
                }
            }]
        });

        let wrap = (data: any) => {
            return '"' + (data !== null && data !== undefined ? data : '') + '"';
        };

        let csvContent = 'data:text/csv;charset=utf-8,';
        csvContent += 'City,';
        csvContent += 'Parcel,';
        csvContent += 'Address,';
        csvContent += 'Area,';
        csvContent += 'Zoning,';
        csvContent += '\r\n';

        for (let row of items) {
            if (!row || !row.lot) {
                continue;
            }
            csvContent += wrap(await Parcel.Parcel.city(row.lot) || '') + ',';
            csvContent += wrap(parcelNumberFormat({ id: await Parcel.Parcel.number(row.lot) })) + ',';
            csvContent += wrap(await Parcel.Parcel.address(row.lot) || '') + ',';

            const area = await Parcel.Parcel.area(row.lot);
            let areaConverted = '';
            if (area && area.value !== undefined && area.value !== null && typeof area.value === 'number') {
                areaConverted = String(Math.round(area.value * 10.7639));

            }
            csvContent += wrap(areaConverted) + ',';
            csvContent += wrap(await Parcel.Parcel.extrasZoning(row.lot) || '') + ',';
            csvContent += '\r\n';
        }

        return { downloadLink: 'length: ' + csvContent.length };
    });
    return queue;
}