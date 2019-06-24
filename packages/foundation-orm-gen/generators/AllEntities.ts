import { EntityModel, AtomicModel, DirectoryModel } from '../Model';
import * as Case from 'change-case';

export function generateAllEntities(entity: EntityModel[], atomics: AtomicModel[], directories: DirectoryModel[]) {
    let res = '';

    //
    // Interface
    //

    res += 'export interface AllEntities {\n';
    res += '    readonly layer: EntityLayer;\n';
    res += '    readonly allEntities: FEntityFactory<FEntity>[];\n';
    for (let d of directories) {
        res += '    readonly ' + d.name + 'Directory: Directory;\n';
    }
    for (let e of entity) {
        res += '    readonly ' + e.name + ': ' + e.name + 'Factory;\n';
    }
    for (let a of atomics) {
        res += '    readonly ' + a.name + ': ' + a.name + 'Factory;\n';
    }
    res += '}\n';

    //
    // Direct
    //

    res += 'export class AllEntitiesDirect extends EntitiesBase implements AllEntities {\n';
    res += '    static readonly schema: FEntitySchema[] = [\n';
    for (let e of entity) {
        res += '        ' + e.name + 'Factory.schema,\n';
    }
    res += '    ];\n';
    res += '\n';
    res += '    static async create(layer: EntityLayer) {\n';
    res += '        let allEntities: FEntityFactory<FEntity>[] = [];\n';
    for (let e of entity) {
        res += '        let ' + e.name + 'Promise = ' + e.name + 'Factory.create(layer);\n';
    }
    for (let a of atomics) {
        res += '        let ' + a.name + 'Promise = ' + a.name + 'Factory.create(layer);\n';
    }
    for (let e of directories) {
        res += '        let ' + e.name + 'DirectoryPromise = layer.resolveCustomDirectory(\'' + Case.camelCase(e.name) + '\');\n';
    }
    for (let e of entity) {
        res += '        allEntities.push(await ' + e.name + 'Promise);\n';
    }
    res += '        let entities = {\n';
    res += '            layer, allEntities,\n';
    for (let e of entity) {
        res += '            ' + e.name + ': await ' + e.name + 'Promise,\n';
    }
    for (let a of atomics) {
        res += '            ' + a.name + ': await ' + a.name + 'Promise,\n';
    }
    for (let e of directories) {
        res += '            ' + e.name + 'Directory: await ' + e.name + 'DirectoryPromise,\n';
    }
    res += '        };\n';
    res += '        return new AllEntitiesDirect(entities);\n';
    res += '    }\n';
    res += '\n';
    res += '    readonly allEntities: FEntityFactory<FEntity>[] = [];\n';
    for (let d of directories) {
        res += '    readonly ' + d.name + 'Directory: Directory;\n';
    }
    for (let a of entity) {
        res += '    readonly ' + a.name + ': ' + a.name + 'Factory;\n';
    }
    for (let a of atomics) {
        res += '    readonly ' + a.name + ': ' + a.name + 'Factory;\n';
    }
    res += '\n';
    res += '    private constructor(entities: AllEntities) {\n';
    res += '        super(entities.layer);\n';
    for (let e of entity) {
        res += '        this.' + e.name + ' = entities.' + e.name + ';\n';
        res += '        this.allEntities.push(this.' + e.name + ');\n';
    }
    for (let a of atomics) {
        res += '        this.' + a.name + ' = entities.' + a.name + ';\n';
    }
    for (let e of directories) {
        res += '        this.' + e.name + 'Directory = entities.' + e.name + 'Directory;\n';
    }
    res += '    }\n';
    res += '}\n';

    //
    // Proxy
    //

    res += 'export class AllEntitiesProxy implements AllEntities {\n';
    res += '    get layer(): EntityLayer {\n';
    res += '        return this.resolver().layer;\n';
    res += '    }\n';
    for (let e of entity) {
        res += '    get ' + e.name + '(): ' + e.name + 'Factory {\n';
        res += '        return this.resolver().' + e.name + ';\n';
        res += '    }\n';
    }
    for (let e of atomics) {
        res += '    get ' + e.name + '(): ' + e.name + 'Factory {\n';
        res += '        return this.resolver().' + e.name + ';\n';
        res += '    }\n';
    }
    for (let e of directories) {
        res += '    get ' + e.name + 'Directory(): Directory {\n';
        res += '        return this.resolver().' + e.name + 'Directory;\n';
        res += '    }\n';
    }
    res += '    get allEntities(): FEntityFactory<FEntity>[] {\n';
    res += '        return this.resolver().allEntities;\n';
    res += '    }\n';

    res += '    private resolver: () => AllEntities;\n';
    res += '    constructor(resolver: () => AllEntities) {\n';
    res += '        this.resolver = resolver;\n';
    res += '    }\n';
    res += '}\n';
    return res;
}