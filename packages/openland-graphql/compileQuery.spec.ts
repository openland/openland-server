import { compileQuery } from './compileQuery';
import { testSchema } from './test/testSchema';

describe('compileQuery', () => {
    it('should prepare query', () => {
        const compiled = compileQuery({ schema: testSchema.schema, document: testSchema.query.meMultiple });
        if (Array.isArray(compiled)) {
            throw Error('');
        }
        // console.warn(JSON.stringify(compiled.selection.fields.me.selector, undefined, 2));
    });
});