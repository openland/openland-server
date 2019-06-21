import { EntityModel, EntityField, EntityIndex } from '../Model';
import * as Case from 'change-case';
import { generateJsonSchema, generateJsonSchemaInterface } from '../../openland-utils/jsonSchema';
import { tab } from '../../openland-utils/string';

function resolveFieldType(field: EntityField) {
    let type: string = field.type;
    if (field.type === 'enum') {
        type = field.enumValues.map((v) => '\'' + v + '\'').join(' | ');
    }
    if (field.type === 'json') {
        if (field.jsonSchema) {
            type = generateJsonSchemaInterface(field.jsonSchema);
        } else {
            type = 'any';
        }
    }
    return type;
}

function resolveIndexField(entity: EntityModel, name: string) {
    for (let e of entity.fields) {
        if (e.name === name) {
            return e;
        }
    }
    for (let k of entity.keys) {
        if (k.name === name) {
            return k;
        }
    }
    if (entity.enableTimestamps) {
        if (name === 'createdAt') {
            return new EntityField(name, 'number', [], null);
        }
        if (name === 'updatedAt') {
            return new EntityField(name, 'number', [], null);
        }
    }
    throw Error('Unable to find field ' + name);
}

export function generateEntity(entity: EntityModel): string {
    let entityKey = Case.camelCase(entity.name);
    let entityClass = Case.pascalCase(entity.name);
    let res = '';
    res += 'export interface ' + entityClass + 'Shape {\n';
    for (let k of entity.fields) {
        res += '    ' + k.name + (k.isNullable ? '?' : '') + ': ' + resolveFieldType(k) + (k.isNullable ? '| null' : '') + ';\n';
    }
    res += '}\n\n';

    // Entity
    res += 'export class ' + entityClass + ' extends FEntity {\n';

    // res += '    static namespace = new SNamespace(\'' + entityKey + '\');\n';
    // res += '    static findById(' + entity.keys.map((v) => v.name + ': ' + v.type).join(', ') + ') {\n';
    // res += '    }\n';
    // Keys
    res += '    readonly entityName: \'' + entity.name + '\' = \'' + entity.name + '\';\n';
    for (let k of entity.keys) {
        let type: string = resolveFieldType(k);
        res += '    get ' + k.name + '(): ' + type + ' { return this._value.' + k.name + '; }\n';
    }

    // Fields
    for (let k of entity.fields) {
        let type: string = resolveFieldType(k);
        if (k.isNullable) {
            type = type + ' | null';
        }

        res += '    get ' + k.name + '(): ' + type + ' {\n';
        if (k.isNullable) {
            res += '        let res = this._value.' + k.name + ';\n';
            res += '        if (res !== null && res !== undefined) { return res; }\n';
            res += '        return null;\n';
        } else {
            res += '        return this._value.' + k.name + ';\n';
        }
        res += '    }\n';
        res += '    set ' + k.name + '(value: ' + type + ') {\n';
        res += '        this._checkIsWritable();\n';
        res += '        if (value === this._value.' + k.name + ') { return; }\n';
        res += '        this._value.' + k.name + ' = value;\n';
        res += '        this.markDirty();\n';
        res += '    }\n';
    }

    res += '}\n\n';

    // Factory
    function buildIndex(index: EntityIndex) {
        let condition = '';
        if (index.condition) {
            let body = index.condition.toString();
            condition = ', ' + body;
        }
        return 'new FEntityIndex(await layer.resolveEntityIndexDirectory(\'' + entityKey + '\', \'' + index.name + '\'), \'' + index.name + '\', [' + index.fields.map((v2) => '\'' + v2 + '\'').join(', ') + '], ' + index.unique + condition + ')';
    }
    res += 'export class ' + entityClass + 'Factory extends FEntityFactory<' + entityClass + '> {\n';

    res += '    static schema: FEntitySchema = {\n';
    res += '        name: \'' + entity.name + '\',\n';
    res += '        editable: ' + entity.editable + ',\n';
    res += '        primaryKeys: [\n';
    for (let k of entity.keys) {
        res += `            { name: '${k.name}', type: '${k.type}' },\n`;
    }
    res += '        ],\n';
    res += '        fields: [\n';
    for (let f of entity.fields) {
        res += `            { name: '${f.name}', type: '${f.type}'`;
        if (f.type === 'enum') {
            res += `, enumValues: [${f.enumValues.map((v2) => `'${v2}'`).join(', ')}]`;
        }
        if (f.isSecure) {
            res += ', secure: true';
        }
        if (f.reference) {
            res += ', reference: { name: \'' + f.reference.name + '\', type: \'' + f.reference.type + '\' }';
        }
        res += ' },\n';
    }
    res += '        ],\n';
    res += '        indexes: [\n';
    for (let i of entity.indexes) {
        res += `            { name: '${i.name}', type: '${i.unique ? 'unique' : 'range'}'`;
        res += `, fields: [${i.fields.map((v) => `'${v}'`).join(', ')}]`;
        if (i.dispName) {
            res += `, displayName: '${i.dispName}'`;
        }
        res += ` },\n`;
    }
    res += '        ],\n';
    // res += '        fields: [' + entity.fields.map((v) => `{ name: '${v.name}', type: '${v.type}', nullable: ${v.isNullable}, secure: ${v.isSecure}, enumValues: [${v.enumValues.map((v2) => `'${v2}'`).join(', ')}] } `).join(', ') + ']\n';
    res += '    };\n\n';

    res += '    static async create(layer: EntityLayer) {\n';
    res += '        let directory = await layer.resolveEntityDirectory(\'' + entityKey + '\');\n';
    res += '        let config = { enableVersioning: ' + entity.enableVersioning + ', enableTimestamps: ' + entity.enableTimestamps + ', validator: ' + entityClass + 'Factory.validate, hasLiveStreams: ' + !!entity.indexes.find((v) => v.streaming) + ' };\n';
    if (entity.indexes.length > 0) {
        for (let index of entity.indexes) {
            res += '        let index' + Case.pascalCase(index.name) + ' = ' + buildIndex(index) + ';\n';
        }
        res += '        let indexes = {\n';
        for (let index of entity.indexes) {
            res += '            ' + Case.camelCase(index.name) + ': index' + Case.pascalCase(index.name) + ',\n';
        }
        res += '        };\n';
        res += '        return new ' + entityClass + 'Factory(layer, directory, config, indexes);\n';
    } else {
        res += '        return new ' + entityClass + 'Factory(layer, directory, config);\n';
    }
    res += '    }\n';
    res += '\n';

    for (let index of entity.indexes) {
        res += '    readonly index' + Case.pascalCase(index.name) + ': FEntityIndex;\n';
    }
    if (entity.indexes.length > 0) {
        res += '\n';
    }
    res += '    private static validate(src: any) {\n';
    for (let k of entity.keys) {
        res += '        validators.notNull(\'' + k.name + '\', src.' + k.name + ');\n';
        if (k.type === 'string') {
            res += '        validators.isString(\'' + k.name + '\', src.' + k.name + ');\n';
        } else if (k.type === 'number') {
            res += '        validators.isNumber(\'' + k.name + '\', src.' + k.name + ');\n';
        } else {
            throw Error('Unsupported key type');
        }
    }
    for (let k of entity.fields) {
        if (!k.isNullable) {
            res += '        validators.notNull(\'' + k.name + '\', src.' + k.name + ');\n';
        }
        if (k.type === 'string') {
            res += '        validators.isString(\'' + k.name + '\', src.' + k.name + ');\n';
        } else if (k.type === 'number') {
            res += '        validators.isNumber(\'' + k.name + '\', src.' + k.name + ');\n';
        } else if (k.type === 'boolean') {
            res += '        validators.isBoolean(\'' + k.name + '\', src.' + k.name + ');\n';
        } else if (k.type === 'json') {
            if (k.jsonSchema) {
                let schema = generateJsonSchema(k.jsonSchema);
                res += '        validators.isJson(\'' + k.name + '\', src.' + k.name + ', ' + tab(2, schema, true) + ');\n';
            }
            // Nothing to validate
        } else if (k.type === 'enum') {
            res += '        validators.isEnum(\'' + k.name + '\', src.' + k.name + ', [' + k.enumValues.map((v) => `'${v}'`).join(', ') + ']);\n';
        }
    }
    res += '    }\n\n';

    res += '    constructor(layer: EntityLayer, directory: Subspace, config: FEntityOptions'
        + (entity.indexes.length > 0 ? ', indexes: { ' + entity.indexes.map((v) => Case.camelCase(v.name) + ': FEntityIndex').join(', ') + ' }' : '') + ') {\n';
    // for (let index of entity.indexes) {
    //     res += '        let index' + Case.pascalCase(index.name) + ' = ' + buildIndex(index) + ';\n';
    // }
    res += '        super(\'' + entity.name + '\', \'' + entityKey + '\', config, ';
    res += '[' + entity.indexes.map((v) => 'indexes.' + Case.camelCase(v.name)).join(', ') + '], ';
    res += 'layer, directory);\n';
    for (let index of entity.indexes) {
        res += '        this.index' + Case.pascalCase(index.name) + ' = indexes.' + Case.camelCase(index.name) + ';\n';
    }
    res += '    }\n';

    res += '    extractId(rawId: any[]) {\n';
    res += '        if (rawId.length !== ' + entity.keys.length + ') { throw Error(\'Invalid key length!\'); }\n';
    res += '        return { ' + entity.keys.map((v, i) => '\'' + v.name + '\': rawId[' + i + ']').join(', ') + ' };\n';
    res += '    }\n';

    // protected _createEntity(context: SContext, namespace: SNamespace, id: (string | number)[], value: any) {
    //     return new Online(context, namespace, id, value);
    // }
    res += '    async findById(ctx: Context, ' + entity.keys.map((v) => v.name + ': ' + v.type).join(', ') + ') {\n';
    res += '        return await this._findById(ctx, [' + entity.keys.map((v) => v.name).join(', ') + ']);\n';
    res += '    }\n';
    res += '    async create(ctx: Context, ' + entity.keys.map((v) => v.name + ': ' + v.type).join(', ') + ', shape: ' + entityClass + 'Shape) {\n';
    res += '        return await this._create(ctx, [' + entity.keys.map((v) => v.name).join(', ') + '], { ' + entity.keys.map((v) => v.name).join(', ') + ', ...shape });\n';
    res += '    }\n';
    res += '    async create_UNSAFE(ctx: Context, ' + entity.keys.map((v) => v.name + ': ' + v.type).join(', ') + ', shape: ' + entityClass + 'Shape) {\n';
    res += '        return await this._create_UNSAFE(ctx, [' + entity.keys.map((v) => v.name).join(', ') + '], { ' + entity.keys.map((v) => v.name).join(', ') + ', ...shape });\n';
    res += '    }\n';
    res += '    watch(ctx: Context, ' + entity.keys.map((v) => v.name + ': ' + v.type).join(', ') + ') {\n';
    res += '        return this._watch(ctx, [' + entity.keys.map((v) => v.name).join(', ') + ']);\n';
    res += '    }\n';

    for (let i of entity.indexes) {
        if (i.unique) {
            res += '    async findFrom' + Case.pascalCase(i.name) + '(ctx: Context, ' + i.fields.map((v) => v + ': ' + resolveFieldType(resolveIndexField(entity, v))).join(', ') + ') {\n';
            res += '        return await this._findFromIndex(ctx, this.index' + Case.pascalCase(i.name) + '.directory, [' + i.fields.join(', ') + ']);\n';
            res += '    }\n';
        }
        // if (!i.unique || i.range) {
        let fs = [...i.fields];
        fs.splice(-1);
        if (i.fields.length > 1) {
            res += '    async allFrom' + Case.pascalCase(i.name) + 'After(ctx: Context, ' + [...fs.map((v) => v + ': ' + resolveFieldType(resolveIndexField(entity, v))), 'after: ' + resolveFieldType(resolveIndexField(entity, i.fields[i.fields.length - 1]))].join(', ') + ') {\n';
            res += '        return await this._findRangeAllAfter(ctx, this.index' + Case.pascalCase(i.name) + '.directory, [' + fs.join(', ') + '], after);\n';
            res += '    }\n';

            res += '    async rangeFrom' + Case.pascalCase(i.name) + 'After(ctx: Context, ' + [...fs.map((v) => v + ': ' + resolveFieldType(resolveIndexField(entity, v))), 'after: ' + resolveFieldType(resolveIndexField(entity, i.fields[i.fields.length - 1])), 'limit: number', 'reversed?: boolean'].join(', ') + ') {\n';
            res += '        return await this._findRangeAfter(ctx, this.index' + Case.pascalCase(i.name) + '.directory, [' + fs.join(', ') + '], after, limit, reversed);\n';
            res += '    }\n';
        }

        res += '    async rangeFrom' + Case.pascalCase(i.name) + '(ctx: Context, ' + [...fs.map((v) => v + ': ' + resolveFieldType(resolveIndexField(entity, v))), 'limit: number', 'reversed?: boolean'].join(', ') + ') {\n';
        res += '        return await this._findRange(ctx, this.index' + Case.pascalCase(i.name) + '.directory, [' + fs.join(', ') + '], limit, reversed);\n';
        res += '    }\n';

        res += '    async rangeFrom' + Case.pascalCase(i.name) + 'WithCursor(ctx: Context, ' + [...fs.map((v) => v + ': ' + resolveFieldType(resolveIndexField(entity, v))), 'limit: number', 'after?: string', 'reversed?: boolean'].join(', ') + ') {\n';
        res += '        return await this._findRangeWithCursor(ctx, this.index' + Case.pascalCase(i.name) + '.directory, [' + fs.join(', ') + '], limit, after, reversed);\n';
        res += '    }\n';

        res += '    async allFrom' + Case.pascalCase(i.name) + '(ctx: Context, ' + [...fs.map((v) => v + ': ' + resolveFieldType(resolveIndexField(entity, v)))].join(', ') + ') {\n';
        res += '        return await this._findAll(ctx, this.index' + Case.pascalCase(i.name) + '.directory, [' + fs.join(', ') + ']);\n';
        res += '    }\n';

        res += '    create' + Case.pascalCase(i.name) + 'Stream(' + [...fs.map((v) => v + ': ' + resolveFieldType(resolveIndexField(entity, v))), 'limit: number', 'after?: string'].join(', ') + ') {\n';
        res += '        return this._createStream(this.index' + Case.pascalCase(i.name) + '.directory, [' + fs.join(', ') + '], limit, after); \n';
        res += '    }\n';
        if (i.streaming) {
            res += '    create' + Case.pascalCase(i.name) + 'LiveStream(ctx: Context, ' + [...fs.map((v) => v + ': ' + resolveFieldType(resolveIndexField(entity, v))), 'limit: number', 'after?: string'].join(', ') + ') {\n';
            res += '        return this._createLiveStream(ctx, this.index' + Case.pascalCase(i.name) + '.directory, [' + fs.join(', ') + '], limit, after); \n';
            res += '    }\n';
        }
        // }
    }

    res += '    protected _createEntity(ctx: Context, value: any, isNew: boolean) {\n';
    res += '        return new ' + entityClass + '(ctx, this.layer, this.directory, [' + entity.keys.map((v) => 'value.' + v.name).join(', ') + '], value, this.options, isNew, this.indexes, \'' + entity.name + '\');\n';
    res += '    }\n';
    res += '}';

    return res;
}