import { RemoteTransport } from './RemoteTransport';
import { container } from '../openland-modules/Modules.container';
import { Client } from 'ts-nats';
import { broker } from '../openland-server/moleculer';
import { Observable } from 'rxjs';
import Moleculer from 'moleculer';
import { createLogger } from '@openland/log';
import { Context } from '@openland/context';
import { onContextCancel } from '@openland/lifetime';

const TRANSPORT_KA = 1000;
const log = createLogger('remote-observable');
export function createRemoteObservable<Args, Event>(root: Context, handler: (ctx: Context, args: Args) => Promise<Observable<Event>>) {
    return async (ctx: Moleculer.Context<{ args: Args, transportId: string }>) => {
        let observable = await handler(root, ctx.params.args);
        let client = container.get<Client>('NATS');
        let transport = new RemoteTransport({
            client,
            keepAlive: TRANSPORT_KA
        });
        onContextCancel(root, () => {
            transport.stop();
        });

        await transport.start();
        transport.connect(ctx.params.transportId);
        let sub = observable.subscribe({
            complete: () => {
                transport.stop();
            },
            next: (value) => {
                transport.send(value);
            },
            error: (value: Error) => {
                log.error(root, value);
            }
        });
        sub.add(() => {
           transport.stop();
        });
        return transport.id;
    };
}

export async function createRemoteStream<Args, Event>(actionName: string, args: Args) {
    let client = container.get<Client>('NATS');
    let transport = new RemoteTransport({
        client,
        keepAlive: TRANSPORT_KA
    });

    await transport.start();
    let remoteId = await broker.call<string, { args: Args, transportId: string }>(actionName, { args, transportId: transport.id });
    transport.connect(remoteId);
    return new Observable<Event>(subscriber => {
        transport.onMessage((event) => {
            subscriber.next(event);
        });
        transport.onClosed((event) => {
            if (event.reason === 'signal') {
                subscriber.complete();
            } else if (event.reason === 'error') {
                subscriber.error(event.error);
            }
        });
    });
}