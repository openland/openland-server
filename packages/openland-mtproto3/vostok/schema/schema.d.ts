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

        /** Message body */
        body: google.protobuf.IAny;
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

        /** Message body. */
        public body: google.protobuf.IAny;

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
