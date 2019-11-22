import { anyStruct, anyType, array, declareSchema, field, integer, model, optional, string } from './vschema';

export const VostokSchema = declareSchema(() => {
    //
    //  Network level
    //

    model('Message', () => {
        field('id', string());
        field('body', anyStruct());
        field('ackMessages', optional(array(string())));
    });

    model('MessagesContainer', () => {
        field('messages', array(anyStruct()));
    });

    model('AckMessages', () => {
        field('ids', array(string()));
    });

    model('MessagesInfoRequest', () => {
        field('messageIds', array(string()));
    });

    model('ResendMessageAnswerRequest', () => {
        field('messageId', string());
    });

    model('MessageNotFoundResponse', () => {
        field('messageId', string());
    });

    model('MessageIsProcessingResponse', () => {
        field('messageId', string());
    });

    model('Initialize', () => {
        field('authToken', string());
        field('sessionId', optional(string()));
    });

    model('InitializeAck', () => {
        field('sessionId', string());
    });

    model('InvalidMessage', () => {
        //
    });

    model('Ping', () => {
        field('id', integer());
    });

    model('Pong', () => {
        field('id', integer());
    });

    //
    // API layer
    //

    model('GQLRequest', () => {
        field('id', string());
        field('operationName', optional(string()));
        field('query', string());
        field('variables', optional(string()));
    });

    model('GQLResponse', () => {
        field('id', string());
        field('result', anyType());
    });

    model('GQLSubscription', () => {
        field('id', string());
        field('operationName', optional(string()));
        field('query', string());
        field('variables', optional(string()));
    });

    model('GQLSubscriptionStop', () => {
        field('id', string());
    });

    model('GQLSubscriptionResponse', () => {
        field('id', string());
        field('result', anyType());
    });

    model('GQLSubscriptionComplete', () => {
        field('id', string());
    });
});