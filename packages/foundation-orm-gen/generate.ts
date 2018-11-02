import { SchemaModel } from './Model';
import * as fs from 'fs';
import { generateEntity } from './generators/Entity';
import { generateAllEntities } from './generators/AllEntities';

export function generate(model: SchemaModel, path: string) {
    let res = '// THIS FILE IS AUTOGENERATED! DO NOT TRY TO EDIT!\n';
    res += 'import { FDBInstance } from \'foundation-orm/FDBInstance\';\n';
    res += 'import { FEntity } from \'foundation-orm/FEntity\';\n';
    res += 'import { FEntitySchema } from \'foundation-orm/FEntitySchema\';\n';
    res += 'import { FEntityIndex } from \'foundation-orm/FEntityIndex\';\n';
    res += 'import { FNamespace } from \'foundation-orm/FNamespace\';\n';
    res += 'import { FEntityFactory } from \'foundation-orm/FEntityFactory\';\n';
    res += 'import { FConnection } from \'foundation-orm/FConnection\';\n';
    res += 'import { validators } from \'foundation-orm/utils/validators\';\n';
    res += '\n';
    for (let e of model.entities) {
        res += generateEntity(e);
        res += '\n';
    }
    res += '\n';
    res += generateAllEntities(model.entities);
    fs.writeFileSync(path, res);
}