import {
    atomicBool,
    atomicInt,
    customDirectory,
    integer,
    primaryKey
} from '@openland/foundationdb-compiler';
import { taskQueue } from '../../openland-module-workers/compiler';

export function scalableStore() {

    // State
    customDirectory('ConferenceScalablePeers');

    // Queue
    taskQueue('ConferenceScalableSession');
    taskQueue('ConferenceScalableShards');

    // Deprecated
    taskQueue('ConferenceScalableQueue');
    taskQueue('ConferenceScalablePurgeQueue');

    // Started flags
    atomicBool('ConferenceScalableStarted', () => {
        primaryKey('id', integer());
    });
    atomicInt('ConferenceScalablePeersCount', () => {
        primaryKey('id', integer());
        primaryKey('category', integer());
    });
}