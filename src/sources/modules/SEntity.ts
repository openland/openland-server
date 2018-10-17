import { SFoundation } from './SFoundation';

export class SEntityInstance<T> {
    readonly id: string | number;
    private _value: T;
    private _dirty = false;
    private _foundation: SFoundation<T>;

    constructor(id: string | number, value: T, foundation: SFoundation<T>) {
        this.id = id;
        this._value = value;
        this._foundation = foundation;
    }

    get value() {
        return this._value;
    }

    set value(value: T) {
        this._value = value;
        this._dirty = true;
    }

    save = async () => {
        if (this._dirty) {
            await this._foundation.set(this._value, this.id);
        }
    }
}

export class SEntity<T> {
    readonly namespace: string;
    private foundation: SFoundation<T>;

    constructor(namespace: string) {
        this.namespace = namespace;
        this.foundation = new SFoundation(namespace);
    }

    getById = async (id: string | number) => {
        let res = await this.foundation.get(id);
        if (res !== null) {
            return new SEntityInstance<T>(id, res, this.foundation);
        } else {
            return null;
        }
    }

    createOrUpdate = async (id: string | number, value: T) => {
        await this.foundation.set(value, id);
        return new SEntityInstance<T>(id, value, this.foundation);
    }
}