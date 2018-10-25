import { EntityModel, EntityField, EntityIndex } from '../Model';
import * as Case from 'change-case';

function resolveFieldType(field: EntityField) {
    let type: string = field.type;
    if (field.type === 'enum') {
        type = field.enumValues.map((v) => '\'' + v + '\'').join(' | ');
    }
    if (field.type === 'json') {
        type = 'any';
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
            return new EntityField(name, 'number', []);
        }
        if (name === 'updatedAt') {
            return new EntityField(name, 'number', []);
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
    for (let k of entity.keys) {
        res += '    get ' + k.name + '() { return this._value.' + k.name + '; }\n';
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
            res += '        if (res) { return res; }\n';
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
        return 'new FEntityIndex(\'' + index.name + '\', [' + index.fields.map((v2) => '\'' + v2 + '\'').join(', ') + '], ' + index.unique + condition + ')';
    }
    res += 'export class ' + entityClass + 'Factory extends FEntityFactory<' + entityClass + '> {\n';
    res += '    constructor(connection: FConnection) {\n';
    res += '        super(connection,\n';
    res += '            new FNamespace(\'entity\', \'' + entityKey + '\'),\n';
    res += '            { enableVersioning: ' + entity.enableVersioning + ', enableTimestamps: ' + entity.enableTimestamps + ' },\n';
    res += '            [' + entity.indexes.map(buildIndex).join(', ') + ']\n';
    res += '        );\n';
    res += '    }\n';
    // protected _createEntity(context: SContext, namespace: SNamespace, id: (string | number)[], value: any) {
    //     return new Online(context, namespace, id, value);
    // }
    res += '    async findById(' + entity.keys.map((v) => v.name + ': ' + v.type).join(', ') + ') {\n';
    res += '        return await this._findById([' + entity.keys.map((v) => v.name).join(', ') + ']);\n';
    res += '    }\n';
    res += '    async create(' + entity.keys.map((v) => v.name + ': ' + v.type).join(', ') + ', shape: ' + entityClass + 'Shape) {\n';
    res += '        return await this._create([' + entity.keys.map((v) => v.name).join(', ') + '], { ' + entity.keys.map((v) => v.name).join(', ') + ', ...shape });\n';
    res += '    }\n';
    res += '    watch(' + entity.keys.map((v) => v.name + ': ' + v.type).join(', ') + ', cb: () => void) {\n';
    res += '        return this._watch([' + entity.keys.map((v) => v.name).join(', ') + '], cb);\n';
    res += '    }\n';

    for (let i of entity.indexes) {
        if (i.unique) {
            res += '    async findFrom' + Case.pascalCase(i.name) + '(' + i.fields.map((v) => v + ': ' + resolveFieldType(resolveIndexField(entity, v))).join(', ') + ') {\n';
            res += '        return await this._findById([' + ['\'__indexes\'', '\'' + i.name + '\'', ...i.fields].join(', ') + ']);\n';
            res += '    }\n';
        }
        if (!i.unique || i.range) {
            let fs = i.fields;
            fs.splice(-1);
            res += '    async rangeFrom' + Case.pascalCase(i.name) + '(' + [...fs.map((v) => v + ': ' + resolveFieldType(resolveIndexField(entity, v))), 'limit: number'].join(', ') + ') {\n';
            res += '        return await this._findRange([' + ['\'__indexes\'', '\'' + i.name + '\'', ...fs].join(', ') + '], limit);\n';
            res += '    }\n';

            res += '    async allFrom' + Case.pascalCase(i.name) + '(' + [...fs.map((v) => v + ': ' + resolveFieldType(resolveIndexField(entity, v)))].join(', ') + ') {\n';
            res += '        return await this._findAll([' + ['\'__indexes\'', '\'' + i.name + '\'', ...fs].join(', ') + ']);\n';
            res += '    }\n';
        }
    }

    res += '    protected _createEntity(value: any, isNew: boolean) {\n';
    res += '        return new ' + entityClass + '(this.connection, this.namespace, [' + entity.keys.map((v) => 'value.' + v.name).join(', ') + '], value, this.options, isNew, this.indexes);\n';
    res += '    }\n';
    res += '}';

    return res;
}