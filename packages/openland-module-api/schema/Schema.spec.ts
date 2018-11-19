import { GQL_SPEC_VERSION } from './SchemaSpec';
import { getSchemeVersion } from './SchemaSpecGenerator';
import { buildSchema } from '../../openland-graphql/buildSchema';

describe('GQLSchema', () => {
    it('should be valid', () => {
        // let schema = Schema();

        // expect(schema).not.toBeNull();
        // makeExecutableSchema({
        //     typeDefs: injectIDScalars(schema),
        //     resolvers: merge(
        //         Basics.Resolvers,
        //         IDScalars,
        //         ...resolvers
        //     ),
        //     schemaDirectives: Directives
        // });
    });

    it('should match schema spec', () => {
        expect(GQL_SPEC_VERSION === getSchemeVersion(buildSchema(__dirname + '/../../'))).toEqual(true);
    });
});