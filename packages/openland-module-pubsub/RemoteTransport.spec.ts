// import { Config } from '../openland-config/Config';
// import { connect, Payload, Client, Subscription } from 'ts-nats';
// import { container } from '../openland-modules/Modules.container';
// import { RemoteTransport } from './RemoteTransport';
// import { delay } from '../openland-utils/timer';
//
// const getNats = () => {
//     return container.get<Client>('NATS');
// };
//
// let interceptors: Subscription[] = [];
// const interceptTransport = async (client: Client, id: string): Promise<any[]> => {
//     let rec: any[] = [];
//     let sub = await client.subscribe(`streams.${id}`, (err, msg) => {
//         rec.push(msg.data);
//     });
//     interceptors.push(sub);
//     return rec;
// };
//
// describe('RemoteTransport', () => {
//     beforeAll(async () => {
//         process.env.OPENLAND_CONFIG = __dirname + '/../../scripts/config_test.json';
//
//         let client = await connect({
//             payload: Payload.JSON,
//             servers: Config.nats ? Config.nats.endpoints : undefined,
//             pingInterval: 5000,
//             reconnectTimeWait: 1000,
//             maxReconnectAttempts: -1,
//             noRandomize: true
//         });
//         container.bind('NATS').toConstantValue(client);
//     });
//     afterAll(async () => {
//         container.get<Client>('NATS').close();
//     });
//     afterEach(() => {
//         for (let int of interceptors) {
//             int.unsubscribe();
//         }
//         interceptors = [];
//     });
//     it('should-send-ka', async () => {
//         let client = getNats();
//
//         let remoteTrasport1 = new RemoteTransport({ client, keepAlive: 10 });
//         let remoteTrasport2 = new RemoteTransport({ client, keepAlive: 10 });
//
//         // add interceptors
//         let rec1 = await interceptTransport(client, remoteTrasport1.id);
//         let rec2 = await interceptTransport(client, remoteTrasport2.id);
//
//         // start transport
//         await remoteTrasport1.start();
//         await remoteTrasport2.start();
//
//         remoteTrasport1.connect(remoteTrasport2.id);
//         remoteTrasport2.connect(remoteTrasport1.id);
//
//         await delay(19);
//
//         remoteTrasport1.stop();
//         remoteTrasport2.stop();
//
//         expect(rec1).toEqual([ { type: 'ka' } ]);
//         expect(rec2).toEqual([ { type: 'ka' } ]);
//     });
//
//     it('should-close-if-remote-broken', async () => {
//         let client = getNats();
//
//         let remoteTrasport1 = new RemoteTransport({ client, keepAlive: 10, timeout: 10 });
//         let onClosed = jest.fn();
//         remoteTrasport1.onClosed(onClosed);
//
//         // start transport
//         await remoteTrasport1.start();
//         await remoteTrasport1.connect('1');
//         await delay(19);
//
//         expect(onClosed.mock.calls.length).toBe(1);
//     });
//
//     it('should-stop-if-remote-stopped', async () => {
//         let client = getNats();
//
//         let remoteTrasport1 = new RemoteTransport({ client, keepAlive: 100 });
//         let remoteTrasport2 = new RemoteTransport({ client, keepAlive: 100 });
//
//         // add interceptors
//         let rec1 = await interceptTransport(client, remoteTrasport1.id);
//         let rec2 = await interceptTransport(client, remoteTrasport2.id);
//
//         // start transport
//         await remoteTrasport1.start();
//         await remoteTrasport2.start();
//
//         remoteTrasport1.connect(remoteTrasport2.id);
//         remoteTrasport2.connect(remoteTrasport1.id);
//
//         remoteTrasport1.stop();
//         // remoteTrasport2.stop();
//         await delay(19);
//
//         expect(rec1).toEqual([]);
//         expect(rec2).toEqual([{ type: 'stop' }]);
//     });
//
//     it('should-send-message-and-recieve', async () => {
//         let client = getNats();
//
//         let remoteTrasport1 = new RemoteTransport({ client, keepAlive: 100 });
//         let remoteTrasport2 = new RemoteTransport({ client, keepAlive: 100 });
//
//         let onMessage1 = jest.fn();
//         let onMessage2 = jest.fn();
//         remoteTrasport1.onMessage(onMessage1);
//         remoteTrasport2.onMessage(onMessage2);
//
//         // add interceptors
//         let rec1 = await interceptTransport(client, remoteTrasport1.id);
//         let rec2 = await interceptTransport(client, remoteTrasport2.id);
//
//         // start transport
//         await remoteTrasport1.start();
//         await remoteTrasport2.start();
//
//         remoteTrasport1.connect(remoteTrasport2.id);
//         remoteTrasport2.connect(remoteTrasport1.id);
//
//         remoteTrasport1.send({ test: true });
//         remoteTrasport1.send({ test: false });
//         await delay(19);
//
//         expect(rec1).toEqual([{seq: 0, type: 'ack'}, {seq: 1, type: 'ack'}]);
//         expect(rec2).toEqual([{ body: { test: true }, seq: 0, type: 'msg' }, { body: { test: false }, seq: 1, type: 'msg' }]);
//         expect(onMessage2.mock.calls.length).toBe(2);
//         expect(onMessage2).toBeCalledWith( { test: true });
//         expect(onMessage2).toBeCalledWith( { test: false });
//         expect(onMessage1.mock.calls.length).toBe(0);
//
//         remoteTrasport1.stop();
//     });
//
//     it('should-recieve-if-not-connected', async () => {
//         let client = getNats();
//
//         let remoteTrasport1 = new RemoteTransport({ client, keepAlive: 100 });
//         let remoteTrasport2 = new RemoteTransport({ client, keepAlive: 100 });
//
//         let onMessage1 = jest.fn();
//         let onMessage2 = jest.fn();
//         remoteTrasport1.onMessage(onMessage1);
//         remoteTrasport2.onMessage(onMessage2);
//
//         // add interceptors
//         let rec1 = await interceptTransport(client, remoteTrasport1.id);
//         let rec2 = await interceptTransport(client, remoteTrasport2.id);
//
//         // start transport
//         await remoteTrasport1.start();
//         await remoteTrasport2.start();
//
//         remoteTrasport1.connect(remoteTrasport2.id);
//         remoteTrasport1.send({ test: true });
//         await delay(10);
//         remoteTrasport2.connect(remoteTrasport1.id);
//         await delay(10);
//
//         expect(rec1).toEqual([{seq: 0, type: 'ack'}]);
//         expect(rec2).toEqual([{ body: { test: true }, seq: 0, type: 'msg' }]);
//         expect(onMessage2.mock.calls.length).toBe(1);
//         expect(onMessage2).toBeCalledWith( { test: true });
//         expect(onMessage1.mock.calls.length).toBe(0);
//
//         remoteTrasport1.stop();
//     });
// });