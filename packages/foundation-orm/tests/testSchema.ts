// THIS FILE IS AUTOGENERATED! DO NOT TRY TO EDIT!
import { FDBInstance } from 'foundation-orm/FDBInstance';
import { FEntity } from 'foundation-orm/FEntity';
import { FEntityIndex } from 'foundation-orm/FEntityIndex';
import { FNamespace } from 'foundation-orm/FNamespace';
import { FEntityFactory } from 'foundation-orm/FEntityFactory';
import { FConnection } from 'foundation-orm/FConnection';
import { validators } from 'foundation-orm/utils/validators';

export interface SimpleEntityShape {
    data: string;
}

export class SimpleEntity extends FEntity {
    get id(): number { return this._value.id; }
    get data(): string {
        return this._value.data;
    }
    set data(value: string) {
        this._checkIsWritable();
        if (value === this._value.data) { return; }
        this._value.data = value;
        this.markDirty();
    }
}

export class SimpleEntityFactory extends FEntityFactory<SimpleEntity> {
    private static validate(src: any) {
        validators.notNull('id', src.id);
        validators.isNumber('id', src.id);
        validators.notNull('data', src.data);
        validators.isString('data', src.data);
    }

    constructor(connection: FConnection) {
        super(connection,
            new FNamespace('entity', 'simpleEntity'),
            { enableVersioning: false, enableTimestamps: false, validator: SimpleEntityFactory.validate, hasLiveStreams: false },
            [],
            'SimpleEntity'
        );
    }
    extractId(rawId: any[]) {
        return { 'id': rawId[0] };
    }
    async findById(id: number) {
        return await this._findById([id]);
    }
    async create(id: number, shape: SimpleEntityShape) {
        return await this._create([id], { id, ...shape });
    }
    watch(id: number, cb: () => void) {
        return this._watch([id], cb);
    }
    protected _createEntity(value: any, isNew: boolean) {
        return new SimpleEntity(this.connection, this.namespace, [value.id], value, this.options, isNew, this.indexes, 'SimpleEntity');
    }
}
export interface VersionedEntityShape {
    data: string;
}

export class VersionedEntity extends FEntity {
    get id(): number { return this._value.id; }
    get data(): string {
        return this._value.data;
    }
    set data(value: string) {
        this._checkIsWritable();
        if (value === this._value.data) { return; }
        this._value.data = value;
        this.markDirty();
    }
}

export class VersionedEntityFactory extends FEntityFactory<VersionedEntity> {
    private static validate(src: any) {
        validators.notNull('id', src.id);
        validators.isNumber('id', src.id);
        validators.notNull('data', src.data);
        validators.isString('data', src.data);
    }

    constructor(connection: FConnection) {
        super(connection,
            new FNamespace('entity', 'versionedEntity'),
            { enableVersioning: true, enableTimestamps: false, validator: VersionedEntityFactory.validate, hasLiveStreams: false },
            [],
            'VersionedEntity'
        );
    }
    extractId(rawId: any[]) {
        return { 'id': rawId[0] };
    }
    async findById(id: number) {
        return await this._findById([id]);
    }
    async create(id: number, shape: VersionedEntityShape) {
        return await this._create([id], { id, ...shape });
    }
    watch(id: number, cb: () => void) {
        return this._watch([id], cb);
    }
    protected _createEntity(value: any, isNew: boolean) {
        return new VersionedEntity(this.connection, this.namespace, [value.id], value, this.options, isNew, this.indexes, 'VersionedEntity');
    }
}
export interface TimestampedEntityShape {
    data: string;
}

export class TimestampedEntity extends FEntity {
    get id(): number { return this._value.id; }
    get data(): string {
        return this._value.data;
    }
    set data(value: string) {
        this._checkIsWritable();
        if (value === this._value.data) { return; }
        this._value.data = value;
        this.markDirty();
    }
}

export class TimestampedEntityFactory extends FEntityFactory<TimestampedEntity> {
    private static validate(src: any) {
        validators.notNull('id', src.id);
        validators.isNumber('id', src.id);
        validators.notNull('data', src.data);
        validators.isString('data', src.data);
    }

    constructor(connection: FConnection) {
        super(connection,
            new FNamespace('entity', 'timestampedEntity'),
            { enableVersioning: false, enableTimestamps: true, validator: TimestampedEntityFactory.validate, hasLiveStreams: false },
            [],
            'TimestampedEntity'
        );
    }
    extractId(rawId: any[]) {
        return { 'id': rawId[0] };
    }
    async findById(id: number) {
        return await this._findById([id]);
    }
    async create(id: number, shape: TimestampedEntityShape) {
        return await this._create([id], { id, ...shape });
    }
    watch(id: number, cb: () => void) {
        return this._watch([id], cb);
    }
    protected _createEntity(value: any, isNew: boolean) {
        return new TimestampedEntity(this.connection, this.namespace, [value.id], value, this.options, isNew, this.indexes, 'TimestampedEntity');
    }
}
export interface IndexedEntityShape {
    data1: string;
    data2: string;
    data3: string;
}

export class IndexedEntity extends FEntity {
    get id(): number { return this._value.id; }
    get data1(): string {
        return this._value.data1;
    }
    set data1(value: string) {
        this._checkIsWritable();
        if (value === this._value.data1) { return; }
        this._value.data1 = value;
        this.markDirty();
    }
    get data2(): string {
        return this._value.data2;
    }
    set data2(value: string) {
        this._checkIsWritable();
        if (value === this._value.data2) { return; }
        this._value.data2 = value;
        this.markDirty();
    }
    get data3(): string {
        return this._value.data3;
    }
    set data3(value: string) {
        this._checkIsWritable();
        if (value === this._value.data3) { return; }
        this._value.data3 = value;
        this.markDirty();
    }
}

export class IndexedEntityFactory extends FEntityFactory<IndexedEntity> {
    private static validate(src: any) {
        validators.notNull('id', src.id);
        validators.isNumber('id', src.id);
        validators.notNull('data1', src.data1);
        validators.isString('data1', src.data1);
        validators.notNull('data2', src.data2);
        validators.isString('data2', src.data2);
        validators.notNull('data3', src.data3);
        validators.isString('data3', src.data3);
    }

    constructor(connection: FConnection) {
        super(connection,
            new FNamespace('entity', 'indexedEntity'),
            { enableVersioning: false, enableTimestamps: false, validator: IndexedEntityFactory.validate, hasLiveStreams: false },
            [new FEntityIndex('default', ['data1', 'data2', 'id'], true)],
            'IndexedEntity'
        );
    }
    extractId(rawId: any[]) {
        return { 'id': rawId[0] };
    }
    async findById(id: number) {
        return await this._findById([id]);
    }
    async create(id: number, shape: IndexedEntityShape) {
        return await this._create([id], { id, ...shape });
    }
    watch(id: number, cb: () => void) {
        return this._watch([id], cb);
    }
    async findFromDefault(data1: string, data2: string, id: number) {
        return await this._findById(['__indexes', 'default', data1, data2, id]);
    }
    protected _createEntity(value: any, isNew: boolean) {
        return new IndexedEntity(this.connection, this.namespace, [value.id], value, this.options, isNew, this.indexes, 'IndexedEntity');
    }
}
export interface IndexedRangeEntityShape {
    data1: string;
    data2: string;
    data3: string;
}

export class IndexedRangeEntity extends FEntity {
    get id(): number { return this._value.id; }
    get data1(): string {
        return this._value.data1;
    }
    set data1(value: string) {
        this._checkIsWritable();
        if (value === this._value.data1) { return; }
        this._value.data1 = value;
        this.markDirty();
    }
    get data2(): string {
        return this._value.data2;
    }
    set data2(value: string) {
        this._checkIsWritable();
        if (value === this._value.data2) { return; }
        this._value.data2 = value;
        this.markDirty();
    }
    get data3(): string {
        return this._value.data3;
    }
    set data3(value: string) {
        this._checkIsWritable();
        if (value === this._value.data3) { return; }
        this._value.data3 = value;
        this.markDirty();
    }
}

export class IndexedRangeEntityFactory extends FEntityFactory<IndexedRangeEntity> {
    private static validate(src: any) {
        validators.notNull('id', src.id);
        validators.isNumber('id', src.id);
        validators.notNull('data1', src.data1);
        validators.isString('data1', src.data1);
        validators.notNull('data2', src.data2);
        validators.isString('data2', src.data2);
        validators.notNull('data3', src.data3);
        validators.isString('data3', src.data3);
    }

    constructor(connection: FConnection) {
        super(connection,
            new FNamespace('entity', 'indexedRangeEntity'),
            { enableVersioning: false, enableTimestamps: false, validator: IndexedRangeEntityFactory.validate, hasLiveStreams: false },
            [new FEntityIndex('default', ['data1', 'data2'], false)],
            'IndexedRangeEntity'
        );
    }
    extractId(rawId: any[]) {
        return { 'id': rawId[0] };
    }
    async findById(id: number) {
        return await this._findById([id]);
    }
    async create(id: number, shape: IndexedRangeEntityShape) {
        return await this._create([id], { id, ...shape });
    }
    watch(id: number, cb: () => void) {
        return this._watch([id], cb);
    }
    async allFromDefaultAfter(data1: string, after: string) {
        return await this._findRangeAllAfter(['__indexes', 'default', data1], after);
    }
    async rangeFromDefault(data1: string, limit: number, reversed?: boolean) {
        return await this._findRange(['__indexes', 'default', data1], limit, reversed);
    }
    async rangeFromDefaultWithCursor(data1: string, limit: number, after?: string, reversed?: boolean) {
        return await this._findRangeWithCursor(['__indexes', 'default', data1], limit, after, reversed);
    }
    async allFromDefault(data1: string) {
        return await this._findAll(['__indexes', 'default', data1]);
    }
    createDefaultStream(data1: string, limit: number, after?: string) {
        return this._createStream(['entity', 'indexedRangeEntity', '__indexes', 'default', data1], limit, after); 
    }
    protected _createEntity(value: any, isNew: boolean) {
        return new IndexedRangeEntity(this.connection, this.namespace, [value.id], value, this.options, isNew, this.indexes, 'IndexedRangeEntity');
    }
}
export interface IndexedPartialEntityShape {
    data1: string;
    data2: string;
    data3: string;
}

export class IndexedPartialEntity extends FEntity {
    get id(): number { return this._value.id; }
    get data1(): string {
        return this._value.data1;
    }
    set data1(value: string) {
        this._checkIsWritable();
        if (value === this._value.data1) { return; }
        this._value.data1 = value;
        this.markDirty();
    }
    get data2(): string {
        return this._value.data2;
    }
    set data2(value: string) {
        this._checkIsWritable();
        if (value === this._value.data2) { return; }
        this._value.data2 = value;
        this.markDirty();
    }
    get data3(): string {
        return this._value.data3;
    }
    set data3(value: string) {
        this._checkIsWritable();
        if (value === this._value.data3) { return; }
        this._value.data3 = value;
        this.markDirty();
    }
}

export class IndexedPartialEntityFactory extends FEntityFactory<IndexedPartialEntity> {
    private static validate(src: any) {
        validators.notNull('id', src.id);
        validators.isNumber('id', src.id);
        validators.notNull('data1', src.data1);
        validators.isString('data1', src.data1);
        validators.notNull('data2', src.data2);
        validators.isString('data2', src.data2);
        validators.notNull('data3', src.data3);
        validators.isString('data3', src.data3);
    }

    constructor(connection: FConnection) {
        super(connection,
            new FNamespace('entity', 'indexedPartialEntity'),
            { enableVersioning: false, enableTimestamps: false, validator: IndexedPartialEntityFactory.validate, hasLiveStreams: false },
            [new FEntityIndex('default', ['data1', 'data2', 'id'], true, (src) => src.data1 === 'hello')],
            'IndexedPartialEntity'
        );
    }
    extractId(rawId: any[]) {
        return { 'id': rawId[0] };
    }
    async findById(id: number) {
        return await this._findById([id]);
    }
    async create(id: number, shape: IndexedPartialEntityShape) {
        return await this._create([id], { id, ...shape });
    }
    watch(id: number, cb: () => void) {
        return this._watch([id], cb);
    }
    async findFromDefault(data1: string, data2: string, id: number) {
        return await this._findById(['__indexes', 'default', data1, data2, id]);
    }
    protected _createEntity(value: any, isNew: boolean) {
        return new IndexedPartialEntity(this.connection, this.namespace, [value.id], value, this.options, isNew, this.indexes, 'IndexedPartialEntity');
    }
}

export class AllEntities extends FDBInstance {
    SimpleEntity: SimpleEntityFactory;
    VersionedEntity: VersionedEntityFactory;
    TimestampedEntity: TimestampedEntityFactory;
    IndexedEntity: IndexedEntityFactory;
    IndexedRangeEntity: IndexedRangeEntityFactory;
    IndexedPartialEntity: IndexedPartialEntityFactory;

    constructor(connection: FConnection) {
        super(connection);
        this.SimpleEntity = new SimpleEntityFactory(connection);
        this.VersionedEntity = new VersionedEntityFactory(connection);
        this.TimestampedEntity = new TimestampedEntityFactory(connection);
        this.IndexedEntity = new IndexedEntityFactory(connection);
        this.IndexedRangeEntity = new IndexedRangeEntityFactory(connection);
        this.IndexedPartialEntity = new IndexedPartialEntityFactory(connection);
    }
}
