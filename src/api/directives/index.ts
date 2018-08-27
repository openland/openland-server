import { SchemaDirectiveVisitor } from 'graphql-tools';
import {
    defaultFieldResolver, GraphQLArgument, GraphQLField, GraphQLInputField, GraphQLNonNull, GraphQLScalarType,
    Kind
} from 'graphql';
import { CallContext } from '../utils/CallContext';
import { ErrorText } from '../../errors/ErrorText';
import { AccessDeniedError } from '../../errors/AccessDeniedError';
import { GraphQLFieldResolver, GraphQLInputType, GraphQLOutputType } from 'graphql/type/definition';
import { withPermission } from '../utils/Resolvers';
import { SecID } from '../../modules/SecID';
import { ValueNode } from 'graphql/language/ast';
import { IDs } from '../utils/IDs';

function createFieldDirective(
    resolver: (root: any, args: any, context: CallContext, info: any, originalResolver: GraphQLFieldResolver<any, any, any>, directiveArgs: any) => any
): typeof SchemaDirectiveVisitor {
    return class extends SchemaDirectiveVisitor {
        visitFieldDefinition(field: GraphQLField<any, any>) {
            const { resolve = defaultFieldResolver } = field;

            field.resolve = async (root: any, args: any, context: CallContext, info: any) => {
                return await resolver(root, args, context, info, resolve, this.args);
            };
        }
    };
}

function createIDDirective(id: GraphQLScalarType) {
    const replaceType = (obj: { type: GraphQLInputType | GraphQLOutputType }) => {
        if (obj.type instanceof GraphQLNonNull) {
            obj.type = new GraphQLNonNull(id);
        } else if (obj.type instanceof GraphQLScalarType) {
            obj.type = id;
        }
    };

    return class extends SchemaDirectiveVisitor {
        visitArgumentDefinition(argument: GraphQLArgument) {
            replaceType(argument);
        }
        visitFieldDefinition(field: GraphQLField<any, any>) {
            replaceType(field);
        }
        visitInputFieldDefinition(field: GraphQLInputField) {
            replaceType(field);
        }
    };
}

export function IDType(type: SecID) {
    return new GraphQLScalarType({
        name: type.typeName + 'ID',

        serialize(value: any) {
            return type.serialize(value);
        },

        parseValue(value: any) {
            if (typeof value !== 'string') {
                throw new Error('ID must be string');
            }

            return type.parse(value);
        },

        parseLiteral(valueNode: ValueNode) {
            if (valueNode.kind === Kind.STRING) {
                return type.parse(valueNode.value);
            }

            throw new Error('ID must be string');
        }
    });
}

export const IDScalars = {
    OrganizationID: IDType(IDs.Organization),
    OrganizationAccountID: IDType(IDs.OrganizationAccount),
    OrganizationListingID: IDType(IDs.OrganizationListing),
    InviteID: IDType(IDs.Invite),
    InviteInfoID: IDType(IDs.InviteInfo),
    StateID: IDType(IDs.State),
    CountyID: IDType(IDs.County),
    CityID: IDType(IDs.City),
    UserID: IDType(IDs.User),
    ProfileID: IDType(IDs.Profile),
    DealID: IDType(IDs.Deal),
    BlockID: IDType(IDs.Block),
    SuperAccountID: IDType(IDs.SuperAccount),
    SuperCityID: IDType(IDs.SuperCity),
    FeatureFlagID: IDType(IDs.FeatureFlag),
    OpportunitiesID: IDType(IDs.Opportunities),
    DebugReaderID: IDType(IDs.DebugReader),
    FolderID: IDType(IDs.Folder),
    FolderItemID: IDType(IDs.FolderItem),
    TaskID: IDType(IDs.Task),
    ConversationID: IDType(IDs.Conversation),
    ConversationSettingsID: IDType(IDs.ConversationSettings),
    ConversationMessageID: IDType(IDs.ConversationMessage),
    NotificationCounterID: IDType(IDs.NotificationCounter),
    UserEventID: IDType(IDs.UserEvent),
    SettingsID: IDType(IDs.Settings),
    WallEntityID: IDType(IDs.WallEntity),
};

class TestType extends GraphQLScalarType {
    constructor () {
        super({
            name: `TestType`,
            serialize (value: any) {
                return '';
            },
            parseValue (value: any) {
                return '11';
            },
            parseLiteral (ast: any) {
                return '11';
            }
        });
    }
}

export const Directives = {
    withAuth: createFieldDirective(async (root, args, ctx, info, resolve) => {
        if (!ctx.uid) {
            throw new AccessDeniedError(ErrorText.permissionDenied);
        } else {
            return await resolve(root, args, ctx, info);
        }
    }),

    withPermissions: createFieldDirective(async (root, args, ctx, info, resolve, dArgs) => {
        let permission = dArgs.permission;

        return await withPermission(
            permission,
            async (_args, _ctx) => resolve(root, _args, _ctx, info)
        )(root, args, ctx);
    }),

    withPermission: createFieldDirective(async (root, args, ctx, info, resolve, dArgs) => {
        let permission = dArgs.permission;

        return await withPermission(
            permission,
            async (_args, _ctx) => resolve(root, _args, _ctx, info)
        )(root, args, ctx);
    }),

    stringNotEmpty: class extends SchemaDirectiveVisitor {
        visitInputFieldDefinition(field: GraphQLInputField) {
            // if (
            //     field.type instanceof TestType ||
            //     (
            //         field.type instanceof GraphQLNonNull &&
            //         field.type.ofType instanceof TestType
            //     )
            // ) {
            //     return;
            // }
            //
            console.log(field);
            if (field.type instanceof GraphQLNonNull) {
                field.type = new GraphQLNonNull(new TestType());
            } else if (field.type instanceof GraphQLScalarType) {
                field.type = new TestType();
            }
        }
    },

    userID: createIDDirective(IDScalars.UserID),
    organizationID: createIDDirective(IDScalars.OrganizationID)
};