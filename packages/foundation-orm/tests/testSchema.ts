// THIS FILE IS AUTOGENERATED! DO NOT TRY TO EDIT!
import { FDBInstance } from 'foundation-orm/FDBInstance';
import { FEntity } from 'foundation-orm/FEntity';
import { FEntityIndex } from 'foundation-orm/FEntityIndex';
import { FNamespace } from 'foundation-orm/FNamespace';
import { FEntityFactory } from 'foundation-orm/FEntityFactory';
import { FConnection } from 'foundation-orm/FConnection';

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
    constructor(connection: FConnection) {
        super(connection,
            new FNamespace('entity', 'simpleEntity'),
            { enableVersioning: false, enableTimestamps: false },
            []
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
        return new SimpleEntity(this.connection, this.namespace, [value.id], value, this.options, isNew, this.indexes);
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
    constructor(connection: FConnection) {
        super(connection,
            new FNamespace('entity', 'versionedEntity'),
            { enableVersioning: true, enableTimestamps: false },
            []
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
        return new VersionedEntity(this.connection, this.namespace, [value.id], value, this.options, isNew, this.indexes);
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
    constructor(connection: FConnection) {
        super(connection,
            new FNamespace('entity', 'timestampedEntity'),
            { enableVersioning: false, enableTimestamps: true },
            []
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
        return new TimestampedEntity(this.connection, this.namespace, [value.id], value, this.options, isNew, this.indexes);
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
    constructor(connection: FConnection) {
        super(connection,
            new FNamespace('entity', 'indexedEntity'),
            { enableVersioning: false, enableTimestamps: false },
            [new FEntityIndex('default', ['data1', 'data2', 'id'], true)]
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
        return new IndexedEntity(this.connection, this.namespace, [value.id], value, this.options, isNew, this.indexes);
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
    constructor(connection: FConnection) {
        super(connection,
            new FNamespace('entity', 'indexedRangeEntity'),
            { enableVersioning: false, enableTimestamps: false },
            [new FEntityIndex('default', ['data1', 'data2'], false)]
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
    async rangeFromDefault(data1: string, limit: number) {
        return await this._findRange(['__indexes', 'default', data1], limit);
    }
    async allFromDefault(data1: string) {
        return await this._findAll(['__indexes', 'default', data1]);
    }
    createDefaultStream(limit: number, after?: string) {
        return this._createStream(['__indexes', 'default'], limit, after); 
    }
    protected _createEntity(value: any, isNew: boolean) {
        return new IndexedRangeEntity(this.connection, this.namespace, [value.id], value, this.options, isNew, this.indexes);
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
    constructor(connection: FConnection) {
        super(connection,
            new FNamespace('entity', 'indexedPartialEntity'),
            { enableVersioning: false, enableTimestamps: false },
            [new FEntityIndex('default', ['data1', 'data2', 'id'], true, (src) => src.data1 === 'hello')]
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
        return new IndexedPartialEntity(this.connection, this.namespace, [value.id], value, this.options, isNew, this.indexes);
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
