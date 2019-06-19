import * as fs from 'fs';
import { Database, Layer, RandomLayer } from '@openland/foundationdb';

function createLayers() {
    let layers: Layer[] = [
        new RandomLayer()
    ];
    return layers;
}

export async function openDatabase() {
    let db: Database;
    if (process.env.FOUNDATION_DB) {
        fs.writeFileSync('foundation.clusterfile', process.env.FOUNDATION_DB);
        db = await Database.open({ clusterFile: 'foundation.clusterfile', layers: createLayers() });
    } else {
        db = await Database.open({ layers: createLayers() });
    }
    return db;
}

export async function openTestDatabase() {
    let db: Database;
    if (process.env.FOUNDATION_DB) {
        fs.writeFileSync('foundation.clusterfile', process.env.FOUNDATION_DB);
        db = await Database.openTest({ clusterFile: 'foundation.clusterfile', layers: createLayers() });
    } else {
        db = await Database.openTest({ layers: createLayers() });
    }
    return db;
}