import express from 'express';
import prepareApp from './utils/prepareApp';
import { initApi } from '../init/initApi';

var server: express.Express;
beforeAll(async () => {
    await prepareApp();
    server = await initApi(true);
});

describe('API Server', () => {
    it('should authenticate correctly', () => {
        // TODO
    });
});