import * as $protobuf from "protobufjs";
/** Namespace vostok. */
export namespace vostok {

    /** Properties of a TopMessage. */
    interface ITopMessage {

        /** TopMessage messagesContainer */
        messagesContainer?: (vostok.IMessagesContainer|null);

        /** TopMessage message */
        message?: (vostok.IMessage|null);

        /** TopMessage ackMessages */
        ackMessages?: (vostok.IAckMessages|null);

        /** TopMessage ping */
        ping?: (vostok.IPing|null);

        /** TopMessage pong */
        pong?: (vostok.IPong|null);

        /** TopMessage messagesInfoRequest */
        messagesInfoRequest?: (vostok.IMessagesInfoRequest|null);

        /** TopMessage resendMessageAnswerRequest */
        resendMessageAnswerRequest?: (vostok.IResendMessageAnswerRequest|null);

        /** TopMessage messageNotFoundResponse */
        messageNotFoundResponse?: (vostok.IMessageNotFoundResponse|null);

        /** TopMessage messageIsProcessingResponse */
        messageIsProcessingResponse?: (vostok.IMessageIsProcessingResponse|null);

        /** TopMessage invalidMessage */
        invalidMessage?: (vostok.IInvalidMessage|null);
    }

    /** Represents a TopMessage. */
    class TopMessage implements ITopMessage {

        /**
         * Constructs a new TopMessage.
         * @param [properties] Properties to set
         */
        constructor(properties?: vostok.ITopMessage);

        /** TopMessage messagesContainer. */
        public messagesContainer?: (vostok.IMessagesContainer|null);

        /** TopMessage message. */
        public message?: (vostok.IMessage|null);

        /** TopMessage ackMessages. */
        public ackMessages?: (vostok.IAckMessages|null);

        /** TopMessage ping. */
        public ping?: (vostok.IPing|null);

        /** TopMessage pong. */
        public pong?: (vostok.IPong|null);

        /** TopMessage messagesInfoRequest. */
        public messagesInfoRequest?: (vostok.IMessagesInfoRequest|null);

        /** TopMessage resendMessageAnswerRequest. */
        public resendMessageAnswerRequest?: (vostok.IResendMessageAnswerRequest|null);

        /** TopMessage messageNotFoundResponse. */
        public messageNotFoundResponse?: (vostok.IMessageNotFoundResponse|null);

        /** TopMessage messageIsProcessingResponse. */
        public messageIsProcessingResponse?: (vostok.IMessageIsProcessingResponse|null);

        /** TopMessage invalidMessage. */
        public invalidMessage?: (vostok.IInvalidMessage|null);

        /** TopMessage body. */
        public body?: ("messagesContainer"|"message"|"ackMessages"|"ping"|"pong"|"messagesInfoRequest"|"resendMessageAnswerRequest"|"messageNotFoundResponse"|"messageIsProcessingResponse"|"invalidMessage");

        /**
         * Creates a new TopMessage instance using the specified properties.
         * @param [properties] Properties to set
         * @returns TopMessage instance
         */
        public static create(properties?: vostok.ITopMessage): vostok.TopMessage;

        /**
         * Encodes the specified TopMessage message. Does not implicitly {@link vostok.TopMessage.verify|verify} messages.
         * @param message TopMessage message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: vostok.ITopMessage, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified TopMessage message, length delimited. Does not implicitly {@link vostok.TopMessage.verify|verify} messages.
         * @param message TopMessage message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: vostok.ITopMessage, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a TopMessage message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns TopMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): vostok.TopMessage;

        /**
         * Decodes a TopMessage message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns TopMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): vostok.TopMessage;

        /**
         * Verifies a TopMessage message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a TopMessage message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns TopMessage
         */
        public static fromObject(object: { [k: string]: any }): vostok.TopMessage;

        /**
         * Creates a plain object from a TopMessage message. Also converts values to other types if specified.
         * @param message TopMessage
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: vostok.TopMessage, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this TopMessage to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };
    }

    /** Properties of a Message. */
    interface IMessage {

        /** Message id */
        id: string;

        /** Message ackMessages */
        ackMessages?: (string[]|null);

        /** Message initialize */
        initialize?: (vostok.IInitialize|null);

        /** Message initializeAck */
        initializeAck?: (vostok.IInitializeAck|null);

        /** Message gqlRequest */
        gqlRequest?: (vostok.IGQLRequest|null);

        /** Message gqlResponse */
        gqlResponse?: (vostok.IGQLResponse|null);

        /** Message gqlSubscription */
        gqlSubscription?: (vostok.IGQLSubscription|null);

        /** Message gqlSubscriptionStop */
        gqlSubscriptionStop?: (vostok.IGQLSubscriptionStop|null);

        /** Message gqlSubscriptionResponse */
        gqlSubscriptionResponse?: (vostok.IGQLSubscriptionResponse|null);

        /** Message gqlSubscriptionComplete */
        gqlSubscriptionComplete?: (vostok.IGQLSubscriptionComplete|null);
    }

    /** Represents a Message. */
    class Message implements IMessage {

        /**
         * Constructs a new Message.
         * @param [properties] Properties to set
         */
        constructor(properties?: vostok.IMessage);

        /** Message id. */
        public id: string;

        /** Message ackMessages. */
        public ackMessages: string[];

        /** Message initialize. */
        public initialize?: (vostok.IInitialize|null);

        /** Message initializeAck. */
        public initializeAck?: (vostok.IInitializeAck|null);

        /** Message gqlRequest. */
        public gqlRequest?: (vostok.IGQLRequest|null);

        /** Message gqlResponse. */
        public gqlResponse?: (vostok.IGQLResponse|null);

        /** Message gqlSubscription. */
        public gqlSubscription?: (vostok.IGQLSubscription|null);

        /** Message gqlSubscriptionStop. */
        public gqlSubscriptionStop?: (vostok.IGQLSubscriptionStop|null);

        /** Message gqlSubscriptionResponse. */
        public gqlSubscriptionResponse?: (vostok.IGQLSubscriptionResponse|null);

        /** Message gqlSubscriptionComplete. */
        public gqlSubscriptionComplete?: (vostok.IGQLSubscriptionComplete|null);

        /** Message body. */
        public body?: ("initialize"|"initializeAck"|"gqlRequest"|"gqlResponse"|"gqlSubscription"|"gqlSubscriptionStop"|"gqlSubscriptionResponse"|"gqlSubscriptionComplete");

        /**
         * Creates a new Message instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Message instance
         */
        public static create(properties?: vostok.IMessage): vostok.Message;

        /**
         * Encodes the specified Message message. Does not implicitly {@link vostok.Message.verify|verify} messages.
         * @param message Message message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: vostok.IMessage, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Message message, length delimited. Does not implicitly {@link vostok.Message.verify|verify} messages.
         * @param message Message message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: vostok.IMessage, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Message message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Message
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): vostok.Message;

        /**
         * Decodes a Message message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Message
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): vostok.Message;

        /**
         * Verifies a Message message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Message message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Message
         */
        public static fromObject(object: { [k: string]: any }): vostok.Message;

        /**
         * Creates a plain object from a Message message. Also converts values to other types if specified.
         * @param message Message
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: vostok.Message, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Message to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };
    }

    /** Properties of a MessagesContainer. */
    interface IMessagesContainer {

        /** MessagesContainer messages */
        messages?: (vostok.ITopMessage[]|null);
    }

    /** Represents a MessagesContainer. */
    class MessagesContainer implements IMessagesContainer {

        /**
         * Constructs a new MessagesContainer.
         * @param [properties] Properties to set
         */
        constructor(properties?: vostok.IMessagesContainer);

        /** MessagesContainer messages. */
        public messages: vostok.ITopMessage[];

        /**
         * Creates a new MessagesContainer instance using the specified properties.
         * @param [properties] Properties to set
         * @returns MessagesContainer instance
         */
        public static create(properties?: vostok.IMessagesContainer): vostok.MessagesContainer;

        /**
         * Encodes the specified MessagesContainer message. Does not implicitly {@link vostok.MessagesContainer.verify|verify} messages.
         * @param message MessagesContainer message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: vostok.IMessagesContainer, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified MessagesContainer message, length delimited. Does not implicitly {@link vostok.MessagesContainer.verify|verify} messages.
         * @param message MessagesContainer message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: vostok.IMessagesContainer, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a MessagesContainer message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns MessagesContainer
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): vostok.MessagesContainer;

        /**
         * Decodes a MessagesContainer message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns MessagesContainer
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): vostok.MessagesContainer;

        /**
         * Verifies a MessagesContainer message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a MessagesContainer message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns MessagesContainer
         */
        public static fromObject(object: { [k: string]: any }): vostok.MessagesContainer;

        /**
         * Creates a plain object from a MessagesContainer message. Also converts values to other types if specified.
         * @param message MessagesContainer
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: vostok.MessagesContainer, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this MessagesContainer to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };
    }

    /** Properties of an AckMessages. */
    interface IAckMessages {

        /** AckMessages ids */
        ids?: (string[]|null);
    }

    /** Represents an AckMessages. */
    class AckMessages implements IAckMessages {

        /**
         * Constructs a new AckMessages.
         * @param [properties] Properties to set
         */
        constructor(properties?: vostok.IAckMessages);

        /** AckMessages ids. */
        public ids: string[];

        /**
         * Creates a new AckMessages instance using the specified properties.
         * @param [properties] Properties to set
         * @returns AckMessages instance
         */
        public static create(properties?: vostok.IAckMessages): vostok.AckMessages;

        /**
         * Encodes the specified AckMessages message. Does not implicitly {@link vostok.AckMessages.verify|verify} messages.
         * @param message AckMessages message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: vostok.IAckMessages, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified AckMessages message, length delimited. Does not implicitly {@link vostok.AckMessages.verify|verify} messages.
         * @param message AckMessages message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: vostok.IAckMessages, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an AckMessages message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns AckMessages
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): vostok.AckMessages;

        /**
         * Decodes an AckMessages message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns AckMessages
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): vostok.AckMessages;

        /**
         * Verifies an AckMessages message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an AckMessages message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns AckMessages
         */
        public static fromObject(object: { [k: string]: any }): vostok.AckMessages;

        /**
         * Creates a plain object from an AckMessages message. Also converts values to other types if specified.
         * @param message AckMessages
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: vostok.AckMessages, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this AckMessages to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };
    }

    /** Properties of a MessagesInfoRequest. */
    interface IMessagesInfoRequest {

        /** MessagesInfoRequest messageIds */
        messageIds?: (string[]|null);
    }

    /** Represents a MessagesInfoRequest. */
    class MessagesInfoRequest implements IMessagesInfoRequest {

        /**
         * Constructs a new MessagesInfoRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: vostok.IMessagesInfoRequest);

        /** MessagesInfoRequest messageIds. */
        public messageIds: string[];

        /**
         * Creates a new MessagesInfoRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns MessagesInfoRequest instance
         */
        public static create(properties?: vostok.IMessagesInfoRequest): vostok.MessagesInfoRequest;

        /**
         * Encodes the specified MessagesInfoRequest message. Does not implicitly {@link vostok.MessagesInfoRequest.verify|verify} messages.
         * @param message MessagesInfoRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: vostok.IMessagesInfoRequest, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified MessagesInfoRequest message, length delimited. Does not implicitly {@link vostok.MessagesInfoRequest.verify|verify} messages.
         * @param message MessagesInfoRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: vostok.IMessagesInfoRequest, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a MessagesInfoRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns MessagesInfoRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): vostok.MessagesInfoRequest;

        /**
         * Decodes a MessagesInfoRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns MessagesInfoRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): vostok.MessagesInfoRequest;

        /**
         * Verifies a MessagesInfoRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a MessagesInfoRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns MessagesInfoRequest
         */
        public static fromObject(object: { [k: string]: any }): vostok.MessagesInfoRequest;

        /**
         * Creates a plain object from a MessagesInfoRequest message. Also converts values to other types if specified.
         * @param message MessagesInfoRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: vostok.MessagesInfoRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this MessagesInfoRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };
    }

    /** Properties of a ResendMessageAnswerRequest. */
    interface IResendMessageAnswerRequest {

        /** ResendMessageAnswerRequest messageId */
        messageId: string;
    }

    /** Represents a ResendMessageAnswerRequest. */
    class ResendMessageAnswerRequest implements IResendMessageAnswerRequest {

        /**
         * Constructs a new ResendMessageAnswerRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: vostok.IResendMessageAnswerRequest);

        /** ResendMessageAnswerRequest messageId. */
        public messageId: string;

        /**
         * Creates a new ResendMessageAnswerRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ResendMessageAnswerRequest instance
         */
        public static create(properties?: vostok.IResendMessageAnswerRequest): vostok.ResendMessageAnswerRequest;

        /**
         * Encodes the specified ResendMessageAnswerRequest message. Does not implicitly {@link vostok.ResendMessageAnswerRequest.verify|verify} messages.
         * @param message ResendMessageAnswerRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: vostok.IResendMessageAnswerRequest, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified ResendMessageAnswerRequest message, length delimited. Does not implicitly {@link vostok.ResendMessageAnswerRequest.verify|verify} messages.
         * @param message ResendMessageAnswerRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: vostok.IResendMessageAnswerRequest, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a ResendMessageAnswerRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ResendMessageAnswerRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): vostok.ResendMessageAnswerRequest;

        /**
         * Decodes a ResendMessageAnswerRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ResendMessageAnswerRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): vostok.ResendMessageAnswerRequest;

        /**
         * Verifies a ResendMessageAnswerRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a ResendMessageAnswerRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ResendMessageAnswerRequest
         */
        public static fromObject(object: { [k: string]: any }): vostok.ResendMessageAnswerRequest;

        /**
         * Creates a plain object from a ResendMessageAnswerRequest message. Also converts values to other types if specified.
         * @param message ResendMessageAnswerRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: vostok.ResendMessageAnswerRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this ResendMessageAnswerRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };
    }

    /** Properties of a MessageNotFoundResponse. */
    interface IMessageNotFoundResponse {

        /** MessageNotFoundResponse messageId */
        messageId: string;
    }

    /** Represents a MessageNotFoundResponse. */
    class MessageNotFoundResponse implements IMessageNotFoundResponse {

        /**
         * Constructs a new MessageNotFoundResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: vostok.IMessageNotFoundResponse);

        /** MessageNotFoundResponse messageId. */
        public messageId: string;

        /**
         * Creates a new MessageNotFoundResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns MessageNotFoundResponse instance
         */
        public static create(properties?: vostok.IMessageNotFoundResponse): vostok.MessageNotFoundResponse;

        /**
         * Encodes the specified MessageNotFoundResponse message. Does not implicitly {@link vostok.MessageNotFoundResponse.verify|verify} messages.
         * @param message MessageNotFoundResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: vostok.IMessageNotFoundResponse, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified MessageNotFoundResponse message, length delimited. Does not implicitly {@link vostok.MessageNotFoundResponse.verify|verify} messages.
         * @param message MessageNotFoundResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: vostok.IMessageNotFoundResponse, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a MessageNotFoundResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns MessageNotFoundResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): vostok.MessageNotFoundResponse;

        /**
         * Decodes a MessageNotFoundResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns MessageNotFoundResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): vostok.MessageNotFoundResponse;

        /**
         * Verifies a MessageNotFoundResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a MessageNotFoundResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns MessageNotFoundResponse
         */
        public static fromObject(object: { [k: string]: any }): vostok.MessageNotFoundResponse;

        /**
         * Creates a plain object from a MessageNotFoundResponse message. Also converts values to other types if specified.
         * @param message MessageNotFoundResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: vostok.MessageNotFoundResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this MessageNotFoundResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };
    }

    /** Properties of a MessageIsProcessingResponse. */
    interface IMessageIsProcessingResponse {

        /** MessageIsProcessingResponse messageId */
        messageId: string;
    }

    /** Represents a MessageIsProcessingResponse. */
    class MessageIsProcessingResponse implements IMessageIsProcessingResponse {

        /**
         * Constructs a new MessageIsProcessingResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: vostok.IMessageIsProcessingResponse);

        /** MessageIsProcessingResponse messageId. */
        public messageId: string;

        /**
         * Creates a new MessageIsProcessingResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns MessageIsProcessingResponse instance
         */
        public static create(properties?: vostok.IMessageIsProcessingResponse): vostok.MessageIsProcessingResponse;

        /**
         * Encodes the specified MessageIsProcessingResponse message. Does not implicitly {@link vostok.MessageIsProcessingResponse.verify|verify} messages.
         * @param message MessageIsProcessingResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: vostok.IMessageIsProcessingResponse, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified MessageIsProcessingResponse message, length delimited. Does not implicitly {@link vostok.MessageIsProcessingResponse.verify|verify} messages.
         * @param message MessageIsProcessingResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: vostok.IMessageIsProcessingResponse, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a MessageIsProcessingResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns MessageIsProcessingResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): vostok.MessageIsProcessingResponse;

        /**
         * Decodes a MessageIsProcessingResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns MessageIsProcessingResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): vostok.MessageIsProcessingResponse;

        /**
         * Verifies a MessageIsProcessingResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a MessageIsProcessingResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns MessageIsProcessingResponse
         */
        public static fromObject(object: { [k: string]: any }): vostok.MessageIsProcessingResponse;

        /**
         * Creates a plain object from a MessageIsProcessingResponse message. Also converts values to other types if specified.
         * @param message MessageIsProcessingResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: vostok.MessageIsProcessingResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this MessageIsProcessingResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };
    }

    /** Properties of an Initialize. */
    interface IInitialize {

        /** Initialize authToken */
        authToken?: (string|null);

        /** Initialize sessionId */
        sessionId?: (string|null);
    }

    /** Represents an Initialize. */
    class Initialize implements IInitialize {

        /**
         * Constructs a new Initialize.
         * @param [properties] Properties to set
         */
        constructor(properties?: vostok.IInitialize);

        /** Initialize authToken. */
        public authToken: string;

        /** Initialize sessionId. */
        public sessionId: string;

        /**
         * Creates a new Initialize instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Initialize instance
         */
        public static create(properties?: vostok.IInitialize): vostok.Initialize;

        /**
         * Encodes the specified Initialize message. Does not implicitly {@link vostok.Initialize.verify|verify} messages.
         * @param message Initialize message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: vostok.IInitialize, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Initialize message, length delimited. Does not implicitly {@link vostok.Initialize.verify|verify} messages.
         * @param message Initialize message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: vostok.IInitialize, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an Initialize message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Initialize
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): vostok.Initialize;

        /**
         * Decodes an Initialize message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Initialize
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): vostok.Initialize;

        /**
         * Verifies an Initialize message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an Initialize message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Initialize
         */
        public static fromObject(object: { [k: string]: any }): vostok.Initialize;

        /**
         * Creates a plain object from an Initialize message. Also converts values to other types if specified.
         * @param message Initialize
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: vostok.Initialize, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Initialize to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };
    }

    /** Properties of an InitializeAck. */
    interface IInitializeAck {

        /** InitializeAck sessionId */
        sessionId: string;
    }

    /** Represents an InitializeAck. */
    class InitializeAck implements IInitializeAck {

        /**
         * Constructs a new InitializeAck.
         * @param [properties] Properties to set
         */
        constructor(properties?: vostok.IInitializeAck);

        /** InitializeAck sessionId. */
        public sessionId: string;

        /**
         * Creates a new InitializeAck instance using the specified properties.
         * @param [properties] Properties to set
         * @returns InitializeAck instance
         */
        public static create(properties?: vostok.IInitializeAck): vostok.InitializeAck;

        /**
         * Encodes the specified InitializeAck message. Does not implicitly {@link vostok.InitializeAck.verify|verify} messages.
         * @param message InitializeAck message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: vostok.IInitializeAck, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified InitializeAck message, length delimited. Does not implicitly {@link vostok.InitializeAck.verify|verify} messages.
         * @param message InitializeAck message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: vostok.IInitializeAck, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an InitializeAck message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns InitializeAck
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): vostok.InitializeAck;

        /**
         * Decodes an InitializeAck message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns InitializeAck
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): vostok.InitializeAck;

        /**
         * Verifies an InitializeAck message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an InitializeAck message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns InitializeAck
         */
        public static fromObject(object: { [k: string]: any }): vostok.InitializeAck;

        /**
         * Creates a plain object from an InitializeAck message. Also converts values to other types if specified.
         * @param message InitializeAck
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: vostok.InitializeAck, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this InitializeAck to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };
    }

    /** Properties of an InvalidMessage. */
    interface IInvalidMessage {
    }

    /** Represents an InvalidMessage. */
    class InvalidMessage implements IInvalidMessage {

        /**
         * Constructs a new InvalidMessage.
         * @param [properties] Properties to set
         */
        constructor(properties?: vostok.IInvalidMessage);

        /**
         * Creates a new InvalidMessage instance using the specified properties.
         * @param [properties] Properties to set
         * @returns InvalidMessage instance
         */
        public static create(properties?: vostok.IInvalidMessage): vostok.InvalidMessage;

        /**
         * Encodes the specified InvalidMessage message. Does not implicitly {@link vostok.InvalidMessage.verify|verify} messages.
         * @param message InvalidMessage message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: vostok.IInvalidMessage, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified InvalidMessage message, length delimited. Does not implicitly {@link vostok.InvalidMessage.verify|verify} messages.
         * @param message InvalidMessage message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: vostok.IInvalidMessage, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes an InvalidMessage message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns InvalidMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): vostok.InvalidMessage;

        /**
         * Decodes an InvalidMessage message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns InvalidMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): vostok.InvalidMessage;

        /**
         * Verifies an InvalidMessage message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates an InvalidMessage message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns InvalidMessage
         */
        public static fromObject(object: { [k: string]: any }): vostok.InvalidMessage;

        /**
         * Creates a plain object from an InvalidMessage message. Also converts values to other types if specified.
         * @param message InvalidMessage
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: vostok.InvalidMessage, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this InvalidMessage to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };
    }

    /** Properties of a Ping. */
    interface IPing {

        /** Ping id */
        id: number;
    }

    /** Represents a Ping. */
    class Ping implements IPing {

        /**
         * Constructs a new Ping.
         * @param [properties] Properties to set
         */
        constructor(properties?: vostok.IPing);

        /** Ping id. */
        public id: number;

        /**
         * Creates a new Ping instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Ping instance
         */
        public static create(properties?: vostok.IPing): vostok.Ping;

        /**
         * Encodes the specified Ping message. Does not implicitly {@link vostok.Ping.verify|verify} messages.
         * @param message Ping message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: vostok.IPing, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Ping message, length delimited. Does not implicitly {@link vostok.Ping.verify|verify} messages.
         * @param message Ping message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: vostok.IPing, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Ping message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Ping
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): vostok.Ping;

        /**
         * Decodes a Ping message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Ping
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): vostok.Ping;

        /**
         * Verifies a Ping message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Ping message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Ping
         */
        public static fromObject(object: { [k: string]: any }): vostok.Ping;

        /**
         * Creates a plain object from a Ping message. Also converts values to other types if specified.
         * @param message Ping
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: vostok.Ping, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Ping to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };
    }

    /** Properties of a Pong. */
    interface IPong {

        /** Pong id */
        id: number;
    }

    /** Represents a Pong. */
    class Pong implements IPong {

        /**
         * Constructs a new Pong.
         * @param [properties] Properties to set
         */
        constructor(properties?: vostok.IPong);

        /** Pong id. */
        public id: number;

        /**
         * Creates a new Pong instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Pong instance
         */
        public static create(properties?: vostok.IPong): vostok.Pong;

        /**
         * Encodes the specified Pong message. Does not implicitly {@link vostok.Pong.verify|verify} messages.
         * @param message Pong message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: vostok.IPong, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Pong message, length delimited. Does not implicitly {@link vostok.Pong.verify|verify} messages.
         * @param message Pong message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: vostok.IPong, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Pong message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Pong
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): vostok.Pong;

        /**
         * Decodes a Pong message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Pong
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): vostok.Pong;

        /**
         * Verifies a Pong message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Pong message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Pong
         */
        public static fromObject(object: { [k: string]: any }): vostok.Pong;

        /**
         * Creates a plain object from a Pong message. Also converts values to other types if specified.
         * @param message Pong
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: vostok.Pong, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Pong to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };
    }

    /** Properties of a GQLRequest. */
    interface IGQLRequest {

        /** GQLRequest id */
        id: string;

        /** GQLRequest operationName */
        operationName?: (string|null);

        /** GQLRequest query */
        query: string;

        /** GQLRequest variables */
        variables?: (string|null);
    }

    /** Represents a GQLRequest. */
    class GQLRequest implements IGQLRequest {

        /**
         * Constructs a new GQLRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: vostok.IGQLRequest);

        /** GQLRequest id. */
        public id: string;

        /** GQLRequest operationName. */
        public operationName: string;

        /** GQLRequest query. */
        public query: string;

        /** GQLRequest variables. */
        public variables: string;

        /**
         * Creates a new GQLRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GQLRequest instance
         */
        public static create(properties?: vostok.IGQLRequest): vostok.GQLRequest;

        /**
         * Encodes the specified GQLRequest message. Does not implicitly {@link vostok.GQLRequest.verify|verify} messages.
         * @param message GQLRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: vostok.IGQLRequest, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified GQLRequest message, length delimited. Does not implicitly {@link vostok.GQLRequest.verify|verify} messages.
         * @param message GQLRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: vostok.IGQLRequest, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a GQLRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GQLRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): vostok.GQLRequest;

        /**
         * Decodes a GQLRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GQLRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): vostok.GQLRequest;

        /**
         * Verifies a GQLRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a GQLRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GQLRequest
         */
        public static fromObject(object: { [k: string]: any }): vostok.GQLRequest;

        /**
         * Creates a plain object from a GQLRequest message. Also converts values to other types if specified.
         * @param message GQLRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: vostok.GQLRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this GQLRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };
    }

    /** Properties of a GQLResponse. */
    interface IGQLResponse {

        /** GQLResponse id */
        id: string;

        /** GQLResponse result */
        result: string;
    }

    /** Represents a GQLResponse. */
    class GQLResponse implements IGQLResponse {

        /**
         * Constructs a new GQLResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: vostok.IGQLResponse);

        /** GQLResponse id. */
        public id: string;

        /** GQLResponse result. */
        public result: string;

        /**
         * Creates a new GQLResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GQLResponse instance
         */
        public static create(properties?: vostok.IGQLResponse): vostok.GQLResponse;

        /**
         * Encodes the specified GQLResponse message. Does not implicitly {@link vostok.GQLResponse.verify|verify} messages.
         * @param message GQLResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: vostok.IGQLResponse, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified GQLResponse message, length delimited. Does not implicitly {@link vostok.GQLResponse.verify|verify} messages.
         * @param message GQLResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: vostok.IGQLResponse, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a GQLResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GQLResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): vostok.GQLResponse;

        /**
         * Decodes a GQLResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GQLResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): vostok.GQLResponse;

        /**
         * Verifies a GQLResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a GQLResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GQLResponse
         */
        public static fromObject(object: { [k: string]: any }): vostok.GQLResponse;

        /**
         * Creates a plain object from a GQLResponse message. Also converts values to other types if specified.
         * @param message GQLResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: vostok.GQLResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this GQLResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };
    }

    /** Properties of a GQLSubscription. */
    interface IGQLSubscription {

        /** GQLSubscription id */
        id: string;

        /** GQLSubscription operationName */
        operationName?: (string|null);

        /** GQLSubscription query */
        query: string;

        /** GQLSubscription variables */
        variables?: (string|null);
    }

    /** Represents a GQLSubscription. */
    class GQLSubscription implements IGQLSubscription {

        /**
         * Constructs a new GQLSubscription.
         * @param [properties] Properties to set
         */
        constructor(properties?: vostok.IGQLSubscription);

        /** GQLSubscription id. */
        public id: string;

        /** GQLSubscription operationName. */
        public operationName: string;

        /** GQLSubscription query. */
        public query: string;

        /** GQLSubscription variables. */
        public variables: string;

        /**
         * Creates a new GQLSubscription instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GQLSubscription instance
         */
        public static create(properties?: vostok.IGQLSubscription): vostok.GQLSubscription;

        /**
         * Encodes the specified GQLSubscription message. Does not implicitly {@link vostok.GQLSubscription.verify|verify} messages.
         * @param message GQLSubscription message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: vostok.IGQLSubscription, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified GQLSubscription message, length delimited. Does not implicitly {@link vostok.GQLSubscription.verify|verify} messages.
         * @param message GQLSubscription message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: vostok.IGQLSubscription, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a GQLSubscription message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GQLSubscription
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): vostok.GQLSubscription;

        /**
         * Decodes a GQLSubscription message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GQLSubscription
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): vostok.GQLSubscription;

        /**
         * Verifies a GQLSubscription message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a GQLSubscription message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GQLSubscription
         */
        public static fromObject(object: { [k: string]: any }): vostok.GQLSubscription;

        /**
         * Creates a plain object from a GQLSubscription message. Also converts values to other types if specified.
         * @param message GQLSubscription
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: vostok.GQLSubscription, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this GQLSubscription to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };
    }

    /** Properties of a GQLSubscriptionStop. */
    interface IGQLSubscriptionStop {

        /** GQLSubscriptionStop id */
        id: string;
    }

    /** Represents a GQLSubscriptionStop. */
    class GQLSubscriptionStop implements IGQLSubscriptionStop {

        /**
         * Constructs a new GQLSubscriptionStop.
         * @param [properties] Properties to set
         */
        constructor(properties?: vostok.IGQLSubscriptionStop);

        /** GQLSubscriptionStop id. */
        public id: string;

        /**
         * Creates a new GQLSubscriptionStop instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GQLSubscriptionStop instance
         */
        public static create(properties?: vostok.IGQLSubscriptionStop): vostok.GQLSubscriptionStop;

        /**
         * Encodes the specified GQLSubscriptionStop message. Does not implicitly {@link vostok.GQLSubscriptionStop.verify|verify} messages.
         * @param message GQLSubscriptionStop message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: vostok.IGQLSubscriptionStop, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified GQLSubscriptionStop message, length delimited. Does not implicitly {@link vostok.GQLSubscriptionStop.verify|verify} messages.
         * @param message GQLSubscriptionStop message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: vostok.IGQLSubscriptionStop, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a GQLSubscriptionStop message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GQLSubscriptionStop
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): vostok.GQLSubscriptionStop;

        /**
         * Decodes a GQLSubscriptionStop message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GQLSubscriptionStop
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): vostok.GQLSubscriptionStop;

        /**
         * Verifies a GQLSubscriptionStop message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a GQLSubscriptionStop message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GQLSubscriptionStop
         */
        public static fromObject(object: { [k: string]: any }): vostok.GQLSubscriptionStop;

        /**
         * Creates a plain object from a GQLSubscriptionStop message. Also converts values to other types if specified.
         * @param message GQLSubscriptionStop
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: vostok.GQLSubscriptionStop, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this GQLSubscriptionStop to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };
    }

    /** Properties of a GQLSubscriptionResponse. */
    interface IGQLSubscriptionResponse {

        /** GQLSubscriptionResponse id */
        id: string;

        /** GQLSubscriptionResponse result */
        result: string;
    }

    /** Represents a GQLSubscriptionResponse. */
    class GQLSubscriptionResponse implements IGQLSubscriptionResponse {

        /**
         * Constructs a new GQLSubscriptionResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: vostok.IGQLSubscriptionResponse);

        /** GQLSubscriptionResponse id. */
        public id: string;

        /** GQLSubscriptionResponse result. */
        public result: string;

        /**
         * Creates a new GQLSubscriptionResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GQLSubscriptionResponse instance
         */
        public static create(properties?: vostok.IGQLSubscriptionResponse): vostok.GQLSubscriptionResponse;

        /**
         * Encodes the specified GQLSubscriptionResponse message. Does not implicitly {@link vostok.GQLSubscriptionResponse.verify|verify} messages.
         * @param message GQLSubscriptionResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: vostok.IGQLSubscriptionResponse, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified GQLSubscriptionResponse message, length delimited. Does not implicitly {@link vostok.GQLSubscriptionResponse.verify|verify} messages.
         * @param message GQLSubscriptionResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: vostok.IGQLSubscriptionResponse, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a GQLSubscriptionResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GQLSubscriptionResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): vostok.GQLSubscriptionResponse;

        /**
         * Decodes a GQLSubscriptionResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GQLSubscriptionResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): vostok.GQLSubscriptionResponse;

        /**
         * Verifies a GQLSubscriptionResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a GQLSubscriptionResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GQLSubscriptionResponse
         */
        public static fromObject(object: { [k: string]: any }): vostok.GQLSubscriptionResponse;

        /**
         * Creates a plain object from a GQLSubscriptionResponse message. Also converts values to other types if specified.
         * @param message GQLSubscriptionResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: vostok.GQLSubscriptionResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this GQLSubscriptionResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };
    }

    /** Properties of a GQLSubscriptionComplete. */
    interface IGQLSubscriptionComplete {

        /** GQLSubscriptionComplete id */
        id: string;
    }

    /** Represents a GQLSubscriptionComplete. */
    class GQLSubscriptionComplete implements IGQLSubscriptionComplete {

        /**
         * Constructs a new GQLSubscriptionComplete.
         * @param [properties] Properties to set
         */
        constructor(properties?: vostok.IGQLSubscriptionComplete);

        /** GQLSubscriptionComplete id. */
        public id: string;

        /**
         * Creates a new GQLSubscriptionComplete instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GQLSubscriptionComplete instance
         */
        public static create(properties?: vostok.IGQLSubscriptionComplete): vostok.GQLSubscriptionComplete;

        /**
         * Encodes the specified GQLSubscriptionComplete message. Does not implicitly {@link vostok.GQLSubscriptionComplete.verify|verify} messages.
         * @param message GQLSubscriptionComplete message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: vostok.IGQLSubscriptionComplete, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified GQLSubscriptionComplete message, length delimited. Does not implicitly {@link vostok.GQLSubscriptionComplete.verify|verify} messages.
         * @param message GQLSubscriptionComplete message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: vostok.IGQLSubscriptionComplete, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a GQLSubscriptionComplete message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GQLSubscriptionComplete
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): vostok.GQLSubscriptionComplete;

        /**
         * Decodes a GQLSubscriptionComplete message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GQLSubscriptionComplete
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): vostok.GQLSubscriptionComplete;

        /**
         * Verifies a GQLSubscriptionComplete message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a GQLSubscriptionComplete message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GQLSubscriptionComplete
         */
        public static fromObject(object: { [k: string]: any }): vostok.GQLSubscriptionComplete;

        /**
         * Creates a plain object from a GQLSubscriptionComplete message. Also converts values to other types if specified.
         * @param message GQLSubscriptionComplete
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: vostok.GQLSubscriptionComplete, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this GQLSubscriptionComplete to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };
    }
}

/** Namespace google. */
export namespace google {

    /** Namespace protobuf. */
    namespace protobuf {

        /** Properties of an Any. */
        interface IAny {

            /** Any type_url */
            type_url?: (string|null);

            /** Any value */
            value?: (Uint8Array|null);
        }

        /** Represents an Any. */
        class Any implements IAny {

            /**
             * Constructs a new Any.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IAny);

            /** Any type_url. */
            public type_url: string;

            /** Any value. */
            public value: Uint8Array;

            /**
             * Creates a new Any instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Any instance
             */
            public static create(properties?: google.protobuf.IAny): google.protobuf.Any;

            /**
             * Encodes the specified Any message. Does not implicitly {@link google.protobuf.Any.verify|verify} messages.
             * @param message Any message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IAny, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified Any message, length delimited. Does not implicitly {@link google.protobuf.Any.verify|verify} messages.
             * @param message Any message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IAny, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes an Any message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns Any
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.Any;

            /**
             * Decodes an Any message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns Any
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.Any;

            /**
             * Verifies an Any message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates an Any message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Any
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.Any;

            /**
             * Creates a plain object from an Any message. Also converts values to other types if specified.
             * @param message Any
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.Any, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Any to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };
        }
    }
}
