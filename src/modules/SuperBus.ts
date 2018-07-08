import sequelize from 'sequelize';
import { Pubsub } from './pubsub';
import { addAfterChangedCommitHook } from '../utils/sequelizeHooks';
import { backoff, forever, delayBreakable } from '../utils/timer';

/**
 * SuperBus is reliable EventBus that guaranteed to deliver all updates from the table
 * and works fast with help of redis subscriptions
 */
export class SuperBus<T, TInstance, TAttributes> {
    public readonly name: string;
    private bus = new Pubsub<T>();
    private readonly model: sequelize.Model<TInstance, TAttributes>;
    private readonly modelName: string;
    private _eventBuilder: ((instance: TInstance) => T) | null = null;
    private _eventHandler: ((instance: T) => void) | null = null;
    private _isStarted = false;

    constructor(name: string, model: sequelize.Model<TInstance, TAttributes>, modelName: string) {
        this.name = name;
        this.model = model;
        this.modelName = modelName;
    }

    eventBuilder(handler: (instance: TInstance) => T) {
        if (this._isStarted) {
            throw Error('Already Started!');
        }
        this._eventBuilder = handler;
    }

    eventHandler(handler: (event: T) => void) {
        if (this._isStarted) {
            throw Error('Already Started!');
        }
        this._eventHandler = handler;
    }

    start() {
        if (this._isStarted) {
            throw Error('Already Started!');
        }
        if (!this._eventBuilder) {
            throw Error('Event Builder not set!');
        }
        if (!this._eventHandler) {
            throw Error('Event Handler not set!');
        }
        this._isStarted = true;
        this.bus.subscribe(this.name, (event) => {
            this._eventHandler!!(event);
        });
        addAfterChangedCommitHook(this.model, (instance) => {
            console.warn('updated');
            this.bus.publish(this.name, this._eventBuilder!!(instance));
        });
        this.startReader();
    }

    private async startReader() {
        let firstEvent = await backoff(async () => this.model.find({
            order: [['updatedAt', 'desc'], ['id', 'desc']],
            logging: false
        }));
        let offset: { id: number, date: Date } | null = null;
        if (firstEvent) {
            offset = { id: (firstEvent as any).id, date: (firstEvent as any).updatedAt };
        }
        let breaker: (() => void) | null = null;
        this.bus.subscribe(this.name, () => {
            if (breaker) {
                breaker();
                breaker = null;
            }
        });
        // let modelName = (this.model as any).options.name.singular;
        forever(async () => {
            let where = (offset
                ? sequelize.literal(`("updatedAt" >= '${offset.date.toISOString()}') AND (("updatedAt" > '${offset.date.toISOString()}') OR ("${this.modelName}"."id" > ${offset.id}))`) as any
                : {});
            let events = await this.model.findAll({
                where: where,
                order: [['updatedAt', 'asc'], ['id', 'asc']],
                limit: 100,
                logging: false
            });
            if (events.length > 0) {
                offset = { id: (events[events.length - 1] as any).id, date: (events[events.length - 1] as any).updatedAt };
                for (let e of events) {
                    this._eventHandler!!(this._eventBuilder!!(e));
                }
                let res = delayBreakable(1000);
                breaker = res.resolver;
                await res.promise;
                breaker = null;
            } else {
                let res = delayBreakable(5000);
                breaker = res.resolver;
                await res.promise;
                breaker = null;
            }
        });
    }
}