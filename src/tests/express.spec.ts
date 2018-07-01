import express from 'express';
import prepareApp from './utils/prepareApp';
import { initApi } from '../init/initApi';
import request from 'supertest';

var app: express.Express;

beforeAll(async () => {
    await prepareApp();
    app = await initApi(true);
});

describe('API Server', () => {
    it('should authenticate correctly', async () => {
        let res = await (request(app)
            .get('/')
            .expect(200));
        expect(res.body).toMatchSnapshot();
    });
    it('should handle graphql queries', async () => {
        let res = (await (request(app)
            .post('/graphql')
            .set('Content-Type', 'application/json')
            .send({ query: '{ me { id } }' })));
        expect(res.body).toMatchSnapshot();
        res = (await (request(app)
            .post('/api')
            .set('Content-Type', 'application/json')
            .send({ query: '{ me { id } }' })));
        expect(res.body).toMatchSnapshot();
    });
    it('should handle graphql queries with tokens', async () => {
        let res = (await (request(app)
            .post('/graphql')
            .set('x-openland-token', 'mock-token')
            .set('Content-Type', 'application/json')
            .send({ query: '{ me { id } }' })));
        expect(res.body).toMatchSnapshot();
    });
    it('should handle graphql queries with tokens in cookies', async () => {
        let res = (await (request(app)
            .post('/graphql')
            .set('Cookie', 'x-openland-token=mock-token')
            .set('Content-Type', 'application/json')
            .send({ query: '{ me { id } }' })));
        expect(res.body).toMatchSnapshot();
    });
    it('should silently ignore graphql queries with bad tokens', async () => {
        let res = (await (request(app)
            .post('/graphql')
            .set('Cookie', 'x-openland-token=mock-token-bad')
            .set('Content-Type', 'application/json')
            .send({ query: '{ me { id } }' })));
        expect(res.body).toMatchSnapshot();
    });
});