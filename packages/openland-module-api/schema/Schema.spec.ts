import { GQL_SPEC_VERSION } from './SchemaSpec';
import { getSchemeVersion } from './SchemaSpecGenerator';
import { buildSchema } from '../../openland-graphql/buildSchema';
import { buildResolvers } from '../../openland-graphql/buildResolvers';
import { makeExecutableSchema } from 'graphql-tools';
import { Directives } from './Directives2';

describe('GQLSchema', () => {
    it('should be valid', () => {
        // let spy = jest.spyOn(console, 'warn');

        let schema = buildSchema(__dirname + '/../../');
        let resolvers = buildResolvers(__dirname + '/../../', true);

        let executableSchema = makeExecutableSchema({
            typeDefs: schema,
            resolvers: resolvers.resolvers,
            schemaDirectives: Directives
        });

        // expect(spy.mock.calls.length).toBe(0);
        expect(executableSchema).not.toBeNull();
    });

    it('should match vostok-schema spec', () => {
        expect(GQL_SPEC_VERSION === getSchemeVersion(buildSchema(__dirname + '/../../'))).toEqual(true);
    });
});