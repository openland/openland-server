/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
"use strict";

var $protobuf = require("protobufjs/minimal");

// Common aliases
var $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

$root.vostok = (function() {

    /**
     * Namespace vostok.
     * @exports vostok
     * @namespace
     */
    var vostok = {};

    vostok.TopMessage = (function() {

        /**
         * Properties of a TopMessage.
         * @memberof vostok
         * @interface ITopMessage
         * @property {vostok.IMessagesContainer|null} [messagesContainer] TopMessage messagesContainer
         * @property {vostok.IMessage|null} [message] TopMessage message
         * @property {vostok.IAckMessages|null} [ackMessages] TopMessage ackMessages
         * @property {vostok.IPing|null} [ping] TopMessage ping
         * @property {vostok.IPong|null} [pong] TopMessage pong
         * @property {vostok.IMessagesInfoRequest|null} [messagesInfoRequest] TopMessage messagesInfoRequest
         * @property {vostok.IResendMessageAnswerRequest|null} [resendMessageAnswerRequest] TopMessage resendMessageAnswerRequest
         * @property {vostok.IMessageNotFoundResponse|null} [messageNotFoundResponse] TopMessage messageNotFoundResponse
         * @property {vostok.IMessageIsProcessingResponse|null} [messageIsProcessingResponse] TopMessage messageIsProcessingResponse
         * @property {vostok.IInvalidMessage|null} [invalidMessage] TopMessage invalidMessage
         */

        /**
         * Constructs a new TopMessage.
         * @memberof vostok
         * @classdesc Represents a TopMessage.
         * @implements ITopMessage
         * @constructor
         * @param {vostok.ITopMessage=} [properties] Properties to set
         */
        function TopMessage(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * TopMessage messagesContainer.
         * @member {vostok.IMessagesContainer|null|undefined} messagesContainer
         * @memberof vostok.TopMessage
         * @instance
         */
        TopMessage.prototype.messagesContainer = null;

        /**
         * TopMessage message.
         * @member {vostok.IMessage|null|undefined} message
         * @memberof vostok.TopMessage
         * @instance
         */
        TopMessage.prototype.message = null;

        /**
         * TopMessage ackMessages.
         * @member {vostok.IAckMessages|null|undefined} ackMessages
         * @memberof vostok.TopMessage
         * @instance
         */
        TopMessage.prototype.ackMessages = null;

        /**
         * TopMessage ping.
         * @member {vostok.IPing|null|undefined} ping
         * @memberof vostok.TopMessage
         * @instance
         */
        TopMessage.prototype.ping = null;

        /**
         * TopMessage pong.
         * @member {vostok.IPong|null|undefined} pong
         * @memberof vostok.TopMessage
         * @instance
         */
        TopMessage.prototype.pong = null;

        /**
         * TopMessage messagesInfoRequest.
         * @member {vostok.IMessagesInfoRequest|null|undefined} messagesInfoRequest
         * @memberof vostok.TopMessage
         * @instance
         */
        TopMessage.prototype.messagesInfoRequest = null;

        /**
         * TopMessage resendMessageAnswerRequest.
         * @member {vostok.IResendMessageAnswerRequest|null|undefined} resendMessageAnswerRequest
         * @memberof vostok.TopMessage
         * @instance
         */
        TopMessage.prototype.resendMessageAnswerRequest = null;

        /**
         * TopMessage messageNotFoundResponse.
         * @member {vostok.IMessageNotFoundResponse|null|undefined} messageNotFoundResponse
         * @memberof vostok.TopMessage
         * @instance
         */
        TopMessage.prototype.messageNotFoundResponse = null;

        /**
         * TopMessage messageIsProcessingResponse.
         * @member {vostok.IMessageIsProcessingResponse|null|undefined} messageIsProcessingResponse
         * @memberof vostok.TopMessage
         * @instance
         */
        TopMessage.prototype.messageIsProcessingResponse = null;

        /**
         * TopMessage invalidMessage.
         * @member {vostok.IInvalidMessage|null|undefined} invalidMessage
         * @memberof vostok.TopMessage
         * @instance
         */
        TopMessage.prototype.invalidMessage = null;

        // OneOf field names bound to virtual getters and setters
        var $oneOfFields;

        /**
         * TopMessage body.
         * @member {"messagesContainer"|"message"|"ackMessages"|"ping"|"pong"|"messagesInfoRequest"|"resendMessageAnswerRequest"|"messageNotFoundResponse"|"messageIsProcessingResponse"|"invalidMessage"|undefined} body
         * @memberof vostok.TopMessage
         * @instance
         */
        Object.defineProperty(TopMessage.prototype, "body", {
            get: $util.oneOfGetter($oneOfFields = ["messagesContainer", "message", "ackMessages", "ping", "pong", "messagesInfoRequest", "resendMessageAnswerRequest", "messageNotFoundResponse", "messageIsProcessingResponse", "invalidMessage"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new TopMessage instance using the specified properties.
         * @function create
         * @memberof vostok.TopMessage
         * @static
         * @param {vostok.ITopMessage=} [properties] Properties to set
         * @returns {vostok.TopMessage} TopMessage instance
         */
        TopMessage.create = function create(properties) {
            return new TopMessage(properties);
        };

        /**
         * Encodes the specified TopMessage message. Does not implicitly {@link vostok.TopMessage.verify|verify} messages.
         * @function encode
         * @memberof vostok.TopMessage
         * @static
         * @param {vostok.ITopMessage} message TopMessage message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        TopMessage.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.messagesContainer != null && message.hasOwnProperty("messagesContainer"))
                $root.vostok.MessagesContainer.encode(message.messagesContainer, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
            if (message.message != null && message.hasOwnProperty("message"))
                $root.vostok.Message.encode(message.message, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
            if (message.ackMessages != null && message.hasOwnProperty("ackMessages"))
                $root.vostok.AckMessages.encode(message.ackMessages, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
            if (message.ping != null && message.hasOwnProperty("ping"))
                $root.vostok.Ping.encode(message.ping, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
            if (message.pong != null && message.hasOwnProperty("pong"))
                $root.vostok.Pong.encode(message.pong, writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
            if (message.messagesInfoRequest != null && message.hasOwnProperty("messagesInfoRequest"))
                $root.vostok.MessagesInfoRequest.encode(message.messagesInfoRequest, writer.uint32(/* id 6, wireType 2 =*/50).fork()).ldelim();
            if (message.resendMessageAnswerRequest != null && message.hasOwnProperty("resendMessageAnswerRequest"))
                $root.vostok.ResendMessageAnswerRequest.encode(message.resendMessageAnswerRequest, writer.uint32(/* id 7, wireType 2 =*/58).fork()).ldelim();
            if (message.messageNotFoundResponse != null && message.hasOwnProperty("messageNotFoundResponse"))
                $root.vostok.MessageNotFoundResponse.encode(message.messageNotFoundResponse, writer.uint32(/* id 8, wireType 2 =*/66).fork()).ldelim();
            if (message.messageIsProcessingResponse != null && message.hasOwnProperty("messageIsProcessingResponse"))
                $root.vostok.MessageIsProcessingResponse.encode(message.messageIsProcessingResponse, writer.uint32(/* id 9, wireType 2 =*/74).fork()).ldelim();
            if (message.invalidMessage != null && message.hasOwnProperty("invalidMessage"))
                $root.vostok.InvalidMessage.encode(message.invalidMessage, writer.uint32(/* id 10, wireType 2 =*/82).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified TopMessage message, length delimited. Does not implicitly {@link vostok.TopMessage.verify|verify} messages.
         * @function encodeDelimited
         * @memberof vostok.TopMessage
         * @static
         * @param {vostok.ITopMessage} message TopMessage message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        TopMessage.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a TopMessage message from the specified reader or buffer.
         * @function decode
         * @memberof vostok.TopMessage
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {vostok.TopMessage} TopMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        TopMessage.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.vostok.TopMessage();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1:
                    message.messagesContainer = $root.vostok.MessagesContainer.decode(reader, reader.uint32());
                    break;
                case 2:
                    message.message = $root.vostok.Message.decode(reader, reader.uint32());
                    break;
                case 3:
                    message.ackMessages = $root.vostok.AckMessages.decode(reader, reader.uint32());
                    break;
                case 4:
                    message.ping = $root.vostok.Ping.decode(reader, reader.uint32());
                    break;
                case 5:
                    message.pong = $root.vostok.Pong.decode(reader, reader.uint32());
                    break;
                case 6:
                    message.messagesInfoRequest = $root.vostok.MessagesInfoRequest.decode(reader, reader.uint32());
                    break;
                case 7:
                    message.resendMessageAnswerRequest = $root.vostok.ResendMessageAnswerRequest.decode(reader, reader.uint32());
                    break;
                case 8:
                    message.messageNotFoundResponse = $root.vostok.MessageNotFoundResponse.decode(reader, reader.uint32());
                    break;
                case 9:
                    message.messageIsProcessingResponse = $root.vostok.MessageIsProcessingResponse.decode(reader, reader.uint32());
                    break;
                case 10:
                    message.invalidMessage = $root.vostok.InvalidMessage.decode(reader, reader.uint32());
                    break;
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a TopMessage message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof vostok.TopMessage
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {vostok.TopMessage} TopMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        TopMessage.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a TopMessage message.
         * @function verify
         * @memberof vostok.TopMessage
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        TopMessage.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            var properties = {};
            if (message.messagesContainer != null && message.hasOwnProperty("messagesContainer")) {
                properties.body = 1;
                {
                    var error = $root.vostok.MessagesContainer.verify(message.messagesContainer);
                    if (error)
                        return "messagesContainer." + error;
                }
            }
            if (message.message != null && message.hasOwnProperty("message")) {
                if (properties.body === 1)
                    return "body: multiple values";
                properties.body = 1;
                {
                    var error = $root.vostok.Message.verify(message.message);
                    if (error)
                        return "message." + error;
                }
            }
            if (message.ackMessages != null && message.hasOwnProperty("ackMessages")) {
                if (properties.body === 1)
                    return "body: multiple values";
                properties.body = 1;
                {
                    var error = $root.vostok.AckMessages.verify(message.ackMessages);
                    if (error)
                        return "ackMessages." + error;
                }
            }
            if (message.ping != null && message.hasOwnProperty("ping")) {
                if (properties.body === 1)
                    return "body: multiple values";
                properties.body = 1;
                {
                    var error = $root.vostok.Ping.verify(message.ping);
                    if (error)
                        return "ping." + error;
                }
            }
            if (message.pong != null && message.hasOwnProperty("pong")) {
                if (properties.body === 1)
                    return "body: multiple values";
                properties.body = 1;
                {
                    var error = $root.vostok.Pong.verify(message.pong);
                    if (error)
                        return "pong." + error;
                }
            }
            if (message.messagesInfoRequest != null && message.hasOwnProperty("messagesInfoRequest")) {
                if (properties.body === 1)
                    return "body: multiple values";
                properties.body = 1;
                {
                    var error = $root.vostok.MessagesInfoRequest.verify(message.messagesInfoRequest);
                    if (error)
                        return "messagesInfoRequest." + error;
                }
            }
            if (message.resendMessageAnswerRequest != null && message.hasOwnProperty("resendMessageAnswerRequest")) {
                if (properties.body === 1)
                    return "body: multiple values";
                properties.body = 1;
                {
                    var error = $root.vostok.ResendMessageAnswerRequest.verify(message.resendMessageAnswerRequest);
                    if (error)
                        return "resendMessageAnswerRequest." + error;
                }
            }
            if (message.messageNotFoundResponse != null && message.hasOwnProperty("messageNotFoundResponse")) {
                if (properties.body === 1)
                    return "body: multiple values";
                properties.body = 1;
                {
                    var error = $root.vostok.MessageNotFoundResponse.verify(message.messageNotFoundResponse);
                    if (error)
                        return "messageNotFoundResponse." + error;
                }
            }
            if (message.messageIsProcessingResponse != null && message.hasOwnProperty("messageIsProcessingResponse")) {
                if (properties.body === 1)
                    return "body: multiple values";
                properties.body = 1;
                {
                    var error = $root.vostok.MessageIsProcessingResponse.verify(message.messageIsProcessingResponse);
                    if (error)
                        return "messageIsProcessingResponse." + error;
                }
            }
            if (message.invalidMessage != null && message.hasOwnProperty("invalidMessage")) {
                if (properties.body === 1)
                    return "body: multiple values";
                properties.body = 1;
                {
                    var error = $root.vostok.InvalidMessage.verify(message.invalidMessage);
                    if (error)
                        return "invalidMessage." + error;
                }
            }
            return null;
        };

        /**
         * Creates a TopMessage message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof vostok.TopMessage
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {vostok.TopMessage} TopMessage
         */
        TopMessage.fromObject = function fromObject(object) {
            if (object instanceof $root.vostok.TopMessage)
                return object;
            var message = new $root.vostok.TopMessage();
            if (object.messagesContainer != null) {
                if (typeof object.messagesContainer !== "object")
                    throw TypeError(".vostok.TopMessage.messagesContainer: object expected");
                message.messagesContainer = $root.vostok.MessagesContainer.fromObject(object.messagesContainer);
            }
            if (object.message != null) {
                if (typeof object.message !== "object")
                    throw TypeError(".vostok.TopMessage.message: object expected");
                message.message = $root.vostok.Message.fromObject(object.message);
            }
            if (object.ackMessages != null) {
                if (typeof object.ackMessages !== "object")
                    throw TypeError(".vostok.TopMessage.ackMessages: object expected");
                message.ackMessages = $root.vostok.AckMessages.fromObject(object.ackMessages);
            }
            if (object.ping != null) {
                if (typeof object.ping !== "object")
                    throw TypeError(".vostok.TopMessage.ping: object expected");
                message.ping = $root.vostok.Ping.fromObject(object.ping);
            }
            if (object.pong != null) {
                if (typeof object.pong !== "object")
                    throw TypeError(".vostok.TopMessage.pong: object expected");
                message.pong = $root.vostok.Pong.fromObject(object.pong);
            }
            if (object.messagesInfoRequest != null) {
                if (typeof object.messagesInfoRequest !== "object")
                    throw TypeError(".vostok.TopMessage.messagesInfoRequest: object expected");
                message.messagesInfoRequest = $root.vostok.MessagesInfoRequest.fromObject(object.messagesInfoRequest);
            }
            if (object.resendMessageAnswerRequest != null) {
                if (typeof object.resendMessageAnswerRequest !== "object")
                    throw TypeError(".vostok.TopMessage.resendMessageAnswerRequest: object expected");
                message.resendMessageAnswerRequest = $root.vostok.ResendMessageAnswerRequest.fromObject(object.resendMessageAnswerRequest);
            }
            if (object.messageNotFoundResponse != null) {
                if (typeof object.messageNotFoundResponse !== "object")
                    throw TypeError(".vostok.TopMessage.messageNotFoundResponse: object expected");
                message.messageNotFoundResponse = $root.vostok.MessageNotFoundResponse.fromObject(object.messageNotFoundResponse);
            }
            if (object.messageIsProcessingResponse != null) {
                if (typeof object.messageIsProcessingResponse !== "object")
                    throw TypeError(".vostok.TopMessage.messageIsProcessingResponse: object expected");
                message.messageIsProcessingResponse = $root.vostok.MessageIsProcessingResponse.fromObject(object.messageIsProcessingResponse);
            }
            if (object.invalidMessage != null) {
                if (typeof object.invalidMessage !== "object")
                    throw TypeError(".vostok.TopMessage.invalidMessage: object expected");
                message.invalidMessage = $root.vostok.InvalidMessage.fromObject(object.invalidMessage);
            }
            return message;
        };

        /**
         * Creates a plain object from a TopMessage message. Also converts values to other types if specified.
         * @function toObject
         * @memberof vostok.TopMessage
         * @static
         * @param {vostok.TopMessage} message TopMessage
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        TopMessage.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (message.messagesContainer != null && message.hasOwnProperty("messagesContainer")) {
                object.messagesContainer = $root.vostok.MessagesContainer.toObject(message.messagesContainer, options);
                if (options.oneofs)
                    object.body = "messagesContainer";
            }
            if (message.message != null && message.hasOwnProperty("message")) {
                object.message = $root.vostok.Message.toObject(message.message, options);
                if (options.oneofs)
                    object.body = "message";
            }
            if (message.ackMessages != null && message.hasOwnProperty("ackMessages")) {
                object.ackMessages = $root.vostok.AckMessages.toObject(message.ackMessages, options);
                if (options.oneofs)
                    object.body = "ackMessages";
            }
            if (message.ping != null && message.hasOwnProperty("ping")) {
                object.ping = $root.vostok.Ping.toObject(message.ping, options);
                if (options.oneofs)
                    object.body = "ping";
            }
            if (message.pong != null && message.hasOwnProperty("pong")) {
                object.pong = $root.vostok.Pong.toObject(message.pong, options);
                if (options.oneofs)
                    object.body = "pong";
            }
            if (message.messagesInfoRequest != null && message.hasOwnProperty("messagesInfoRequest")) {
                object.messagesInfoRequest = $root.vostok.MessagesInfoRequest.toObject(message.messagesInfoRequest, options);
                if (options.oneofs)
                    object.body = "messagesInfoRequest";
            }
            if (message.resendMessageAnswerRequest != null && message.hasOwnProperty("resendMessageAnswerRequest")) {
                object.resendMessageAnswerRequest = $root.vostok.ResendMessageAnswerRequest.toObject(message.resendMessageAnswerRequest, options);
                if (options.oneofs)
                    object.body = "resendMessageAnswerRequest";
            }
            if (message.messageNotFoundResponse != null && message.hasOwnProperty("messageNotFoundResponse")) {
                object.messageNotFoundResponse = $root.vostok.MessageNotFoundResponse.toObject(message.messageNotFoundResponse, options);
                if (options.oneofs)
                    object.body = "messageNotFoundResponse";
            }
            if (message.messageIsProcessingResponse != null && message.hasOwnProperty("messageIsProcessingResponse")) {
                object.messageIsProcessingResponse = $root.vostok.MessageIsProcessingResponse.toObject(message.messageIsProcessingResponse, options);
                if (options.oneofs)
                    object.body = "messageIsProcessingResponse";
            }
            if (message.invalidMessage != null && message.hasOwnProperty("invalidMessage")) {
                object.invalidMessage = $root.vostok.InvalidMessage.toObject(message.invalidMessage, options);
                if (options.oneofs)
                    object.body = "invalidMessage";
            }
            return object;
        };

        /**
         * Converts this TopMessage to JSON.
         * @function toJSON
         * @memberof vostok.TopMessage
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        TopMessage.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        return TopMessage;
    })();

    vostok.Message = (function() {

        /**
         * Properties of a Message.
         * @memberof vostok
         * @interface IMessage
         * @property {string} id Message id
         * @property {Array.<string>|null} [ackMessages] Message ackMessages
         * @property {google.protobuf.IAny} body Message body
         */

        /**
         * Constructs a new Message.
         * @memberof vostok
         * @classdesc Represents a Message.
         * @implements IMessage
         * @constructor
         * @param {vostok.IMessage=} [properties] Properties to set
         */
        function Message(properties) {
            this.ackMessages = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Message id.
         * @member {string} id
         * @memberof vostok.Message
         * @instance
         */
        Message.prototype.id = "";

        /**
         * Message ackMessages.
         * @member {Array.<string>} ackMessages
         * @memberof vostok.Message
         * @instance
         */
        Message.prototype.ackMessages = $util.emptyArray;

        /**
         * Message body.
         * @member {google.protobuf.IAny} body
         * @memberof vostok.Message
         * @instance
         */
        Message.prototype.body = null;

        /**
         * Creates a new Message instance using the specified properties.
         * @function create
         * @memberof vostok.Message
         * @static
         * @param {vostok.IMessage=} [properties] Properties to set
         * @returns {vostok.Message} Message instance
         */
        Message.create = function create(properties) {
            return new Message(properties);
        };

        /**
         * Encodes the specified Message message. Does not implicitly {@link vostok.Message.verify|verify} messages.
         * @function encode
         * @memberof vostok.Message
         * @static
         * @param {vostok.IMessage} message Message message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Message.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
            if (message.ackMessages != null && message.ackMessages.length)
                for (var i = 0; i < message.ackMessages.length; ++i)
                    writer.uint32(/* id 2, wireType 2 =*/18).string(message.ackMessages[i]);
            $root.google.protobuf.Any.encode(message.body, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified Message message, length delimited. Does not implicitly {@link vostok.Message.verify|verify} messages.
         * @function encodeDelimited
         * @memberof vostok.Message
         * @static
         * @param {vostok.IMessage} message Message message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Message.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a Message message from the specified reader or buffer.
         * @function decode
         * @memberof vostok.Message
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {vostok.Message} Message
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Message.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.vostok.Message();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1:
                    message.id = reader.string();
                    break;
                case 2:
                    if (!(message.ackMessages && message.ackMessages.length))
                        message.ackMessages = [];
                    message.ackMessages.push(reader.string());
                    break;
                case 3:
                    message.body = $root.google.protobuf.Any.decode(reader, reader.uint32());
                    break;
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            if (!message.hasOwnProperty("id"))
                throw $util.ProtocolError("missing required 'id'", { instance: message });
            if (!message.hasOwnProperty("body"))
                throw $util.ProtocolError("missing required 'body'", { instance: message });
            return message;
        };

        /**
         * Decodes a Message message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof vostok.Message
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {vostok.Message} Message
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Message.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a Message message.
         * @function verify
         * @memberof vostok.Message
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Message.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (!$util.isString(message.id))
                return "id: string expected";
            if (message.ackMessages != null && message.hasOwnProperty("ackMessages")) {
                if (!Array.isArray(message.ackMessages))
                    return "ackMessages: array expected";
                for (var i = 0; i < message.ackMessages.length; ++i)
                    if (!$util.isString(message.ackMessages[i]))
                        return "ackMessages: string[] expected";
            }
            {
                var error = $root.google.protobuf.Any.verify(message.body);
                if (error)
                    return "body." + error;
            }
            return null;
        };

        /**
         * Creates a Message message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof vostok.Message
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {vostok.Message} Message
         */
        Message.fromObject = function fromObject(object) {
            if (object instanceof $root.vostok.Message)
                return object;
            var message = new $root.vostok.Message();
            if (object.id != null)
                message.id = String(object.id);
            if (object.ackMessages) {
                if (!Array.isArray(object.ackMessages))
                    throw TypeError(".vostok.Message.ackMessages: array expected");
                message.ackMessages = [];
                for (var i = 0; i < object.ackMessages.length; ++i)
                    message.ackMessages[i] = String(object.ackMessages[i]);
            }
            if (object.body != null) {
                if (typeof object.body !== "object")
                    throw TypeError(".vostok.Message.body: object expected");
                message.body = $root.google.protobuf.Any.fromObject(object.body);
            }
            return message;
        };

        /**
         * Creates a plain object from a Message message. Also converts values to other types if specified.
         * @function toObject
         * @memberof vostok.Message
         * @static
         * @param {vostok.Message} message Message
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Message.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults)
                object.ackMessages = [];
            if (options.defaults) {
                object.id = "";
                object.body = null;
            }
            if (message.id != null && message.hasOwnProperty("id"))
                object.id = message.id;
            if (message.ackMessages && message.ackMessages.length) {
                object.ackMessages = [];
                for (var j = 0; j < message.ackMessages.length; ++j)
                    object.ackMessages[j] = message.ackMessages[j];
            }
            if (message.body != null && message.hasOwnProperty("body"))
                object.body = $root.google.protobuf.Any.toObject(message.body, options);
            return object;
        };

        /**
         * Converts this Message to JSON.
         * @function toJSON
         * @memberof vostok.Message
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Message.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        return Message;
    })();

    vostok.MessagesContainer = (function() {

        /**
         * Properties of a MessagesContainer.
         * @memberof vostok
         * @interface IMessagesContainer
         * @property {Array.<vostok.ITopMessage>|null} [messages] MessagesContainer messages
         */

        /**
         * Constructs a new MessagesContainer.
         * @memberof vostok
         * @classdesc Represents a MessagesContainer.
         * @implements IMessagesContainer
         * @constructor
         * @param {vostok.IMessagesContainer=} [properties] Properties to set
         */
        function MessagesContainer(properties) {
            this.messages = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * MessagesContainer messages.
         * @member {Array.<vostok.ITopMessage>} messages
         * @memberof vostok.MessagesContainer
         * @instance
         */
        MessagesContainer.prototype.messages = $util.emptyArray;

        /**
         * Creates a new MessagesContainer instance using the specified properties.
         * @function create
         * @memberof vostok.MessagesContainer
         * @static
         * @param {vostok.IMessagesContainer=} [properties] Properties to set
         * @returns {vostok.MessagesContainer} MessagesContainer instance
         */
        MessagesContainer.create = function create(properties) {
            return new MessagesContainer(properties);
        };

        /**
         * Encodes the specified MessagesContainer message. Does not implicitly {@link vostok.MessagesContainer.verify|verify} messages.
         * @function encode
         * @memberof vostok.MessagesContainer
         * @static
         * @param {vostok.IMessagesContainer} message MessagesContainer message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        MessagesContainer.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.messages != null && message.messages.length)
                for (var i = 0; i < message.messages.length; ++i)
                    $root.vostok.TopMessage.encode(message.messages[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified MessagesContainer message, length delimited. Does not implicitly {@link vostok.MessagesContainer.verify|verify} messages.
         * @function encodeDelimited
         * @memberof vostok.MessagesContainer
         * @static
         * @param {vostok.IMessagesContainer} message MessagesContainer message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        MessagesContainer.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a MessagesContainer message from the specified reader or buffer.
         * @function decode
         * @memberof vostok.MessagesContainer
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {vostok.MessagesContainer} MessagesContainer
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        MessagesContainer.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.vostok.MessagesContainer();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1:
                    if (!(message.messages && message.messages.length))
                        message.messages = [];
                    message.messages.push($root.vostok.TopMessage.decode(reader, reader.uint32()));
                    break;
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a MessagesContainer message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof vostok.MessagesContainer
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {vostok.MessagesContainer} MessagesContainer
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        MessagesContainer.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a MessagesContainer message.
         * @function verify
         * @memberof vostok.MessagesContainer
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        MessagesContainer.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.messages != null && message.hasOwnProperty("messages")) {
                if (!Array.isArray(message.messages))
                    return "messages: array expected";
                for (var i = 0; i < message.messages.length; ++i) {
                    var error = $root.vostok.TopMessage.verify(message.messages[i]);
                    if (error)
                        return "messages." + error;
                }
            }
            return null;
        };

        /**
         * Creates a MessagesContainer message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof vostok.MessagesContainer
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {vostok.MessagesContainer} MessagesContainer
         */
        MessagesContainer.fromObject = function fromObject(object) {
            if (object instanceof $root.vostok.MessagesContainer)
                return object;
            var message = new $root.vostok.MessagesContainer();
            if (object.messages) {
                if (!Array.isArray(object.messages))
                    throw TypeError(".vostok.MessagesContainer.messages: array expected");
                message.messages = [];
                for (var i = 0; i < object.messages.length; ++i) {
                    if (typeof object.messages[i] !== "object")
                        throw TypeError(".vostok.MessagesContainer.messages: object expected");
                    message.messages[i] = $root.vostok.TopMessage.fromObject(object.messages[i]);
                }
            }
            return message;
        };

        /**
         * Creates a plain object from a MessagesContainer message. Also converts values to other types if specified.
         * @function toObject
         * @memberof vostok.MessagesContainer
         * @static
         * @param {vostok.MessagesContainer} message MessagesContainer
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        MessagesContainer.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults)
                object.messages = [];
            if (message.messages && message.messages.length) {
                object.messages = [];
                for (var j = 0; j < message.messages.length; ++j)
                    object.messages[j] = $root.vostok.TopMessage.toObject(message.messages[j], options);
            }
            return object;
        };

        /**
         * Converts this MessagesContainer to JSON.
         * @function toJSON
         * @memberof vostok.MessagesContainer
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        MessagesContainer.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        return MessagesContainer;
    })();

    vostok.AckMessages = (function() {

        /**
         * Properties of an AckMessages.
         * @memberof vostok
         * @interface IAckMessages
         * @property {Array.<string>|null} [ids] AckMessages ids
         */

        /**
         * Constructs a new AckMessages.
         * @memberof vostok
         * @classdesc Represents an AckMessages.
         * @implements IAckMessages
         * @constructor
         * @param {vostok.IAckMessages=} [properties] Properties to set
         */
        function AckMessages(properties) {
            this.ids = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * AckMessages ids.
         * @member {Array.<string>} ids
         * @memberof vostok.AckMessages
         * @instance
         */
        AckMessages.prototype.ids = $util.emptyArray;

        /**
         * Creates a new AckMessages instance using the specified properties.
         * @function create
         * @memberof vostok.AckMessages
         * @static
         * @param {vostok.IAckMessages=} [properties] Properties to set
         * @returns {vostok.AckMessages} AckMessages instance
         */
        AckMessages.create = function create(properties) {
            return new AckMessages(properties);
        };

        /**
         * Encodes the specified AckMessages message. Does not implicitly {@link vostok.AckMessages.verify|verify} messages.
         * @function encode
         * @memberof vostok.AckMessages
         * @static
         * @param {vostok.IAckMessages} message AckMessages message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        AckMessages.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.ids != null && message.ids.length)
                for (var i = 0; i < message.ids.length; ++i)
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.ids[i]);
            return writer;
        };

        /**
         * Encodes the specified AckMessages message, length delimited. Does not implicitly {@link vostok.AckMessages.verify|verify} messages.
         * @function encodeDelimited
         * @memberof vostok.AckMessages
         * @static
         * @param {vostok.IAckMessages} message AckMessages message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        AckMessages.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes an AckMessages message from the specified reader or buffer.
         * @function decode
         * @memberof vostok.AckMessages
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {vostok.AckMessages} AckMessages
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        AckMessages.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.vostok.AckMessages();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1:
                    if (!(message.ids && message.ids.length))
                        message.ids = [];
                    message.ids.push(reader.string());
                    break;
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes an AckMessages message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof vostok.AckMessages
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {vostok.AckMessages} AckMessages
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        AckMessages.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies an AckMessages message.
         * @function verify
         * @memberof vostok.AckMessages
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        AckMessages.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.ids != null && message.hasOwnProperty("ids")) {
                if (!Array.isArray(message.ids))
                    return "ids: array expected";
                for (var i = 0; i < message.ids.length; ++i)
                    if (!$util.isString(message.ids[i]))
                        return "ids: string[] expected";
            }
            return null;
        };

        /**
         * Creates an AckMessages message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof vostok.AckMessages
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {vostok.AckMessages} AckMessages
         */
        AckMessages.fromObject = function fromObject(object) {
            if (object instanceof $root.vostok.AckMessages)
                return object;
            var message = new $root.vostok.AckMessages();
            if (object.ids) {
                if (!Array.isArray(object.ids))
                    throw TypeError(".vostok.AckMessages.ids: array expected");
                message.ids = [];
                for (var i = 0; i < object.ids.length; ++i)
                    message.ids[i] = String(object.ids[i]);
            }
            return message;
        };

        /**
         * Creates a plain object from an AckMessages message. Also converts values to other types if specified.
         * @function toObject
         * @memberof vostok.AckMessages
         * @static
         * @param {vostok.AckMessages} message AckMessages
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        AckMessages.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults)
                object.ids = [];
            if (message.ids && message.ids.length) {
                object.ids = [];
                for (var j = 0; j < message.ids.length; ++j)
                    object.ids[j] = message.ids[j];
            }
            return object;
        };

        /**
         * Converts this AckMessages to JSON.
         * @function toJSON
         * @memberof vostok.AckMessages
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        AckMessages.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        return AckMessages;
    })();

    vostok.MessagesInfoRequest = (function() {

        /**
         * Properties of a MessagesInfoRequest.
         * @memberof vostok
         * @interface IMessagesInfoRequest
         * @property {Array.<string>|null} [messageIds] MessagesInfoRequest messageIds
         */

        /**
         * Constructs a new MessagesInfoRequest.
         * @memberof vostok
         * @classdesc Represents a MessagesInfoRequest.
         * @implements IMessagesInfoRequest
         * @constructor
         * @param {vostok.IMessagesInfoRequest=} [properties] Properties to set
         */
        function MessagesInfoRequest(properties) {
            this.messageIds = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * MessagesInfoRequest messageIds.
         * @member {Array.<string>} messageIds
         * @memberof vostok.MessagesInfoRequest
         * @instance
         */
        MessagesInfoRequest.prototype.messageIds = $util.emptyArray;

        /**
         * Creates a new MessagesInfoRequest instance using the specified properties.
         * @function create
         * @memberof vostok.MessagesInfoRequest
         * @static
         * @param {vostok.IMessagesInfoRequest=} [properties] Properties to set
         * @returns {vostok.MessagesInfoRequest} MessagesInfoRequest instance
         */
        MessagesInfoRequest.create = function create(properties) {
            return new MessagesInfoRequest(properties);
        };

        /**
         * Encodes the specified MessagesInfoRequest message. Does not implicitly {@link vostok.MessagesInfoRequest.verify|verify} messages.
         * @function encode
         * @memberof vostok.MessagesInfoRequest
         * @static
         * @param {vostok.IMessagesInfoRequest} message MessagesInfoRequest message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        MessagesInfoRequest.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.messageIds != null && message.messageIds.length)
                for (var i = 0; i < message.messageIds.length; ++i)
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.messageIds[i]);
            return writer;
        };

        /**
         * Encodes the specified MessagesInfoRequest message, length delimited. Does not implicitly {@link vostok.MessagesInfoRequest.verify|verify} messages.
         * @function encodeDelimited
         * @memberof vostok.MessagesInfoRequest
         * @static
         * @param {vostok.IMessagesInfoRequest} message MessagesInfoRequest message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        MessagesInfoRequest.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a MessagesInfoRequest message from the specified reader or buffer.
         * @function decode
         * @memberof vostok.MessagesInfoRequest
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {vostok.MessagesInfoRequest} MessagesInfoRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        MessagesInfoRequest.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.vostok.MessagesInfoRequest();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1:
                    if (!(message.messageIds && message.messageIds.length))
                        message.messageIds = [];
                    message.messageIds.push(reader.string());
                    break;
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a MessagesInfoRequest message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof vostok.MessagesInfoRequest
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {vostok.MessagesInfoRequest} MessagesInfoRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        MessagesInfoRequest.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a MessagesInfoRequest message.
         * @function verify
         * @memberof vostok.MessagesInfoRequest
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        MessagesInfoRequest.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.messageIds != null && message.hasOwnProperty("messageIds")) {
                if (!Array.isArray(message.messageIds))
                    return "messageIds: array expected";
                for (var i = 0; i < message.messageIds.length; ++i)
                    if (!$util.isString(message.messageIds[i]))
                        return "messageIds: string[] expected";
            }
            return null;
        };

        /**
         * Creates a MessagesInfoRequest message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof vostok.MessagesInfoRequest
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {vostok.MessagesInfoRequest} MessagesInfoRequest
         */
        MessagesInfoRequest.fromObject = function fromObject(object) {
            if (object instanceof $root.vostok.MessagesInfoRequest)
                return object;
            var message = new $root.vostok.MessagesInfoRequest();
            if (object.messageIds) {
                if (!Array.isArray(object.messageIds))
                    throw TypeError(".vostok.MessagesInfoRequest.messageIds: array expected");
                message.messageIds = [];
                for (var i = 0; i < object.messageIds.length; ++i)
                    message.messageIds[i] = String(object.messageIds[i]);
            }
            return message;
        };

        /**
         * Creates a plain object from a MessagesInfoRequest message. Also converts values to other types if specified.
         * @function toObject
         * @memberof vostok.MessagesInfoRequest
         * @static
         * @param {vostok.MessagesInfoRequest} message MessagesInfoRequest
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        MessagesInfoRequest.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults)
                object.messageIds = [];
            if (message.messageIds && message.messageIds.length) {
                object.messageIds = [];
                for (var j = 0; j < message.messageIds.length; ++j)
                    object.messageIds[j] = message.messageIds[j];
            }
            return object;
        };

        /**
         * Converts this MessagesInfoRequest to JSON.
         * @function toJSON
         * @memberof vostok.MessagesInfoRequest
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        MessagesInfoRequest.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        return MessagesInfoRequest;
    })();

    vostok.ResendMessageAnswerRequest = (function() {

        /**
         * Properties of a ResendMessageAnswerRequest.
         * @memberof vostok
         * @interface IResendMessageAnswerRequest
         * @property {string} messageId ResendMessageAnswerRequest messageId
         */

        /**
         * Constructs a new ResendMessageAnswerRequest.
         * @memberof vostok
         * @classdesc Represents a ResendMessageAnswerRequest.
         * @implements IResendMessageAnswerRequest
         * @constructor
         * @param {vostok.IResendMessageAnswerRequest=} [properties] Properties to set
         */
        function ResendMessageAnswerRequest(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ResendMessageAnswerRequest messageId.
         * @member {string} messageId
         * @memberof vostok.ResendMessageAnswerRequest
         * @instance
         */
        ResendMessageAnswerRequest.prototype.messageId = "";

        /**
         * Creates a new ResendMessageAnswerRequest instance using the specified properties.
         * @function create
         * @memberof vostok.ResendMessageAnswerRequest
         * @static
         * @param {vostok.IResendMessageAnswerRequest=} [properties] Properties to set
         * @returns {vostok.ResendMessageAnswerRequest} ResendMessageAnswerRequest instance
         */
        ResendMessageAnswerRequest.create = function create(properties) {
            return new ResendMessageAnswerRequest(properties);
        };

        /**
         * Encodes the specified ResendMessageAnswerRequest message. Does not implicitly {@link vostok.ResendMessageAnswerRequest.verify|verify} messages.
         * @function encode
         * @memberof vostok.ResendMessageAnswerRequest
         * @static
         * @param {vostok.IResendMessageAnswerRequest} message ResendMessageAnswerRequest message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ResendMessageAnswerRequest.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.messageId);
            return writer;
        };

        /**
         * Encodes the specified ResendMessageAnswerRequest message, length delimited. Does not implicitly {@link vostok.ResendMessageAnswerRequest.verify|verify} messages.
         * @function encodeDelimited
         * @memberof vostok.ResendMessageAnswerRequest
         * @static
         * @param {vostok.IResendMessageAnswerRequest} message ResendMessageAnswerRequest message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ResendMessageAnswerRequest.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ResendMessageAnswerRequest message from the specified reader or buffer.
         * @function decode
         * @memberof vostok.ResendMessageAnswerRequest
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {vostok.ResendMessageAnswerRequest} ResendMessageAnswerRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ResendMessageAnswerRequest.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.vostok.ResendMessageAnswerRequest();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1:
                    message.messageId = reader.string();
                    break;
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            if (!message.hasOwnProperty("messageId"))
                throw $util.ProtocolError("missing required 'messageId'", { instance: message });
            return message;
        };

        /**
         * Decodes a ResendMessageAnswerRequest message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof vostok.ResendMessageAnswerRequest
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {vostok.ResendMessageAnswerRequest} ResendMessageAnswerRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ResendMessageAnswerRequest.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ResendMessageAnswerRequest message.
         * @function verify
         * @memberof vostok.ResendMessageAnswerRequest
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ResendMessageAnswerRequest.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (!$util.isString(message.messageId))
                return "messageId: string expected";
            return null;
        };

        /**
         * Creates a ResendMessageAnswerRequest message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof vostok.ResendMessageAnswerRequest
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {vostok.ResendMessageAnswerRequest} ResendMessageAnswerRequest
         */
        ResendMessageAnswerRequest.fromObject = function fromObject(object) {
            if (object instanceof $root.vostok.ResendMessageAnswerRequest)
                return object;
            var message = new $root.vostok.ResendMessageAnswerRequest();
            if (object.messageId != null)
                message.messageId = String(object.messageId);
            return message;
        };

        /**
         * Creates a plain object from a ResendMessageAnswerRequest message. Also converts values to other types if specified.
         * @function toObject
         * @memberof vostok.ResendMessageAnswerRequest
         * @static
         * @param {vostok.ResendMessageAnswerRequest} message ResendMessageAnswerRequest
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ResendMessageAnswerRequest.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults)
                object.messageId = "";
            if (message.messageId != null && message.hasOwnProperty("messageId"))
                object.messageId = message.messageId;
            return object;
        };

        /**
         * Converts this ResendMessageAnswerRequest to JSON.
         * @function toJSON
         * @memberof vostok.ResendMessageAnswerRequest
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ResendMessageAnswerRequest.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        return ResendMessageAnswerRequest;
    })();

    vostok.MessageNotFoundResponse = (function() {

        /**
         * Properties of a MessageNotFoundResponse.
         * @memberof vostok
         * @interface IMessageNotFoundResponse
         * @property {string} messageId MessageNotFoundResponse messageId
         */

        /**
         * Constructs a new MessageNotFoundResponse.
         * @memberof vostok
         * @classdesc Represents a MessageNotFoundResponse.
         * @implements IMessageNotFoundResponse
         * @constructor
         * @param {vostok.IMessageNotFoundResponse=} [properties] Properties to set
         */
        function MessageNotFoundResponse(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * MessageNotFoundResponse messageId.
         * @member {string} messageId
         * @memberof vostok.MessageNotFoundResponse
         * @instance
         */
        MessageNotFoundResponse.prototype.messageId = "";

        /**
         * Creates a new MessageNotFoundResponse instance using the specified properties.
         * @function create
         * @memberof vostok.MessageNotFoundResponse
         * @static
         * @param {vostok.IMessageNotFoundResponse=} [properties] Properties to set
         * @returns {vostok.MessageNotFoundResponse} MessageNotFoundResponse instance
         */
        MessageNotFoundResponse.create = function create(properties) {
            return new MessageNotFoundResponse(properties);
        };

        /**
         * Encodes the specified MessageNotFoundResponse message. Does not implicitly {@link vostok.MessageNotFoundResponse.verify|verify} messages.
         * @function encode
         * @memberof vostok.MessageNotFoundResponse
         * @static
         * @param {vostok.IMessageNotFoundResponse} message MessageNotFoundResponse message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        MessageNotFoundResponse.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.messageId);
            return writer;
        };

        /**
         * Encodes the specified MessageNotFoundResponse message, length delimited. Does not implicitly {@link vostok.MessageNotFoundResponse.verify|verify} messages.
         * @function encodeDelimited
         * @memberof vostok.MessageNotFoundResponse
         * @static
         * @param {vostok.IMessageNotFoundResponse} message MessageNotFoundResponse message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        MessageNotFoundResponse.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a MessageNotFoundResponse message from the specified reader or buffer.
         * @function decode
         * @memberof vostok.MessageNotFoundResponse
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {vostok.MessageNotFoundResponse} MessageNotFoundResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        MessageNotFoundResponse.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.vostok.MessageNotFoundResponse();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1:
                    message.messageId = reader.string();
                    break;
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            if (!message.hasOwnProperty("messageId"))
                throw $util.ProtocolError("missing required 'messageId'", { instance: message });
            return message;
        };

        /**
         * Decodes a MessageNotFoundResponse message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof vostok.MessageNotFoundResponse
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {vostok.MessageNotFoundResponse} MessageNotFoundResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        MessageNotFoundResponse.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a MessageNotFoundResponse message.
         * @function verify
         * @memberof vostok.MessageNotFoundResponse
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        MessageNotFoundResponse.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (!$util.isString(message.messageId))
                return "messageId: string expected";
            return null;
        };

        /**
         * Creates a MessageNotFoundResponse message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof vostok.MessageNotFoundResponse
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {vostok.MessageNotFoundResponse} MessageNotFoundResponse
         */
        MessageNotFoundResponse.fromObject = function fromObject(object) {
            if (object instanceof $root.vostok.MessageNotFoundResponse)
                return object;
            var message = new $root.vostok.MessageNotFoundResponse();
            if (object.messageId != null)
                message.messageId = String(object.messageId);
            return message;
        };

        /**
         * Creates a plain object from a MessageNotFoundResponse message. Also converts values to other types if specified.
         * @function toObject
         * @memberof vostok.MessageNotFoundResponse
         * @static
         * @param {vostok.MessageNotFoundResponse} message MessageNotFoundResponse
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        MessageNotFoundResponse.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults)
                object.messageId = "";
            if (message.messageId != null && message.hasOwnProperty("messageId"))
                object.messageId = message.messageId;
            return object;
        };

        /**
         * Converts this MessageNotFoundResponse to JSON.
         * @function toJSON
         * @memberof vostok.MessageNotFoundResponse
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        MessageNotFoundResponse.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        return MessageNotFoundResponse;
    })();

    vostok.MessageIsProcessingResponse = (function() {

        /**
         * Properties of a MessageIsProcessingResponse.
         * @memberof vostok
         * @interface IMessageIsProcessingResponse
         * @property {string} messageId MessageIsProcessingResponse messageId
         */

        /**
         * Constructs a new MessageIsProcessingResponse.
         * @memberof vostok
         * @classdesc Represents a MessageIsProcessingResponse.
         * @implements IMessageIsProcessingResponse
         * @constructor
         * @param {vostok.IMessageIsProcessingResponse=} [properties] Properties to set
         */
        function MessageIsProcessingResponse(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * MessageIsProcessingResponse messageId.
         * @member {string} messageId
         * @memberof vostok.MessageIsProcessingResponse
         * @instance
         */
        MessageIsProcessingResponse.prototype.messageId = "";

        /**
         * Creates a new MessageIsProcessingResponse instance using the specified properties.
         * @function create
         * @memberof vostok.MessageIsProcessingResponse
         * @static
         * @param {vostok.IMessageIsProcessingResponse=} [properties] Properties to set
         * @returns {vostok.MessageIsProcessingResponse} MessageIsProcessingResponse instance
         */
        MessageIsProcessingResponse.create = function create(properties) {
            return new MessageIsProcessingResponse(properties);
        };

        /**
         * Encodes the specified MessageIsProcessingResponse message. Does not implicitly {@link vostok.MessageIsProcessingResponse.verify|verify} messages.
         * @function encode
         * @memberof vostok.MessageIsProcessingResponse
         * @static
         * @param {vostok.IMessageIsProcessingResponse} message MessageIsProcessingResponse message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        MessageIsProcessingResponse.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.messageId);
            return writer;
        };

        /**
         * Encodes the specified MessageIsProcessingResponse message, length delimited. Does not implicitly {@link vostok.MessageIsProcessingResponse.verify|verify} messages.
         * @function encodeDelimited
         * @memberof vostok.MessageIsProcessingResponse
         * @static
         * @param {vostok.IMessageIsProcessingResponse} message MessageIsProcessingResponse message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        MessageIsProcessingResponse.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a MessageIsProcessingResponse message from the specified reader or buffer.
         * @function decode
         * @memberof vostok.MessageIsProcessingResponse
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {vostok.MessageIsProcessingResponse} MessageIsProcessingResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        MessageIsProcessingResponse.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.vostok.MessageIsProcessingResponse();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1:
                    message.messageId = reader.string();
                    break;
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            if (!message.hasOwnProperty("messageId"))
                throw $util.ProtocolError("missing required 'messageId'", { instance: message });
            return message;
        };

        /**
         * Decodes a MessageIsProcessingResponse message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof vostok.MessageIsProcessingResponse
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {vostok.MessageIsProcessingResponse} MessageIsProcessingResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        MessageIsProcessingResponse.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a MessageIsProcessingResponse message.
         * @function verify
         * @memberof vostok.MessageIsProcessingResponse
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        MessageIsProcessingResponse.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (!$util.isString(message.messageId))
                return "messageId: string expected";
            return null;
        };

        /**
         * Creates a MessageIsProcessingResponse message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof vostok.MessageIsProcessingResponse
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {vostok.MessageIsProcessingResponse} MessageIsProcessingResponse
         */
        MessageIsProcessingResponse.fromObject = function fromObject(object) {
            if (object instanceof $root.vostok.MessageIsProcessingResponse)
                return object;
            var message = new $root.vostok.MessageIsProcessingResponse();
            if (object.messageId != null)
                message.messageId = String(object.messageId);
            return message;
        };

        /**
         * Creates a plain object from a MessageIsProcessingResponse message. Also converts values to other types if specified.
         * @function toObject
         * @memberof vostok.MessageIsProcessingResponse
         * @static
         * @param {vostok.MessageIsProcessingResponse} message MessageIsProcessingResponse
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        MessageIsProcessingResponse.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults)
                object.messageId = "";
            if (message.messageId != null && message.hasOwnProperty("messageId"))
                object.messageId = message.messageId;
            return object;
        };

        /**
         * Converts this MessageIsProcessingResponse to JSON.
         * @function toJSON
         * @memberof vostok.MessageIsProcessingResponse
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        MessageIsProcessingResponse.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        return MessageIsProcessingResponse;
    })();

    vostok.Initialize = (function() {

        /**
         * Properties of an Initialize.
         * @memberof vostok
         * @interface IInitialize
         * @property {string|null} [authToken] Initialize authToken
         * @property {string|null} [sessionId] Initialize sessionId
         */

        /**
         * Constructs a new Initialize.
         * @memberof vostok
         * @classdesc Represents an Initialize.
         * @implements IInitialize
         * @constructor
         * @param {vostok.IInitialize=} [properties] Properties to set
         */
        function Initialize(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Initialize authToken.
         * @member {string} authToken
         * @memberof vostok.Initialize
         * @instance
         */
        Initialize.prototype.authToken = "";

        /**
         * Initialize sessionId.
         * @member {string} sessionId
         * @memberof vostok.Initialize
         * @instance
         */
        Initialize.prototype.sessionId = "";

        /**
         * Creates a new Initialize instance using the specified properties.
         * @function create
         * @memberof vostok.Initialize
         * @static
         * @param {vostok.IInitialize=} [properties] Properties to set
         * @returns {vostok.Initialize} Initialize instance
         */
        Initialize.create = function create(properties) {
            return new Initialize(properties);
        };

        /**
         * Encodes the specified Initialize message. Does not implicitly {@link vostok.Initialize.verify|verify} messages.
         * @function encode
         * @memberof vostok.Initialize
         * @static
         * @param {vostok.IInitialize} message Initialize message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Initialize.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.authToken != null && message.hasOwnProperty("authToken"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.authToken);
            if (message.sessionId != null && message.hasOwnProperty("sessionId"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.sessionId);
            return writer;
        };

        /**
         * Encodes the specified Initialize message, length delimited. Does not implicitly {@link vostok.Initialize.verify|verify} messages.
         * @function encodeDelimited
         * @memberof vostok.Initialize
         * @static
         * @param {vostok.IInitialize} message Initialize message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Initialize.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes an Initialize message from the specified reader or buffer.
         * @function decode
         * @memberof vostok.Initialize
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {vostok.Initialize} Initialize
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Initialize.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.vostok.Initialize();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1:
                    message.authToken = reader.string();
                    break;
                case 2:
                    message.sessionId = reader.string();
                    break;
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes an Initialize message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof vostok.Initialize
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {vostok.Initialize} Initialize
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Initialize.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies an Initialize message.
         * @function verify
         * @memberof vostok.Initialize
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Initialize.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.authToken != null && message.hasOwnProperty("authToken"))
                if (!$util.isString(message.authToken))
                    return "authToken: string expected";
            if (message.sessionId != null && message.hasOwnProperty("sessionId"))
                if (!$util.isString(message.sessionId))
                    return "sessionId: string expected";
            return null;
        };

        /**
         * Creates an Initialize message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof vostok.Initialize
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {vostok.Initialize} Initialize
         */
        Initialize.fromObject = function fromObject(object) {
            if (object instanceof $root.vostok.Initialize)
                return object;
            var message = new $root.vostok.Initialize();
            if (object.authToken != null)
                message.authToken = String(object.authToken);
            if (object.sessionId != null)
                message.sessionId = String(object.sessionId);
            return message;
        };

        /**
         * Creates a plain object from an Initialize message. Also converts values to other types if specified.
         * @function toObject
         * @memberof vostok.Initialize
         * @static
         * @param {vostok.Initialize} message Initialize
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Initialize.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.authToken = "";
                object.sessionId = "";
            }
            if (message.authToken != null && message.hasOwnProperty("authToken"))
                object.authToken = message.authToken;
            if (message.sessionId != null && message.hasOwnProperty("sessionId"))
                object.sessionId = message.sessionId;
            return object;
        };

        /**
         * Converts this Initialize to JSON.
         * @function toJSON
         * @memberof vostok.Initialize
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Initialize.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        return Initialize;
    })();

    vostok.InitializeAck = (function() {

        /**
         * Properties of an InitializeAck.
         * @memberof vostok
         * @interface IInitializeAck
         * @property {string} sessionId InitializeAck sessionId
         */

        /**
         * Constructs a new InitializeAck.
         * @memberof vostok
         * @classdesc Represents an InitializeAck.
         * @implements IInitializeAck
         * @constructor
         * @param {vostok.IInitializeAck=} [properties] Properties to set
         */
        function InitializeAck(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * InitializeAck sessionId.
         * @member {string} sessionId
         * @memberof vostok.InitializeAck
         * @instance
         */
        InitializeAck.prototype.sessionId = "";

        /**
         * Creates a new InitializeAck instance using the specified properties.
         * @function create
         * @memberof vostok.InitializeAck
         * @static
         * @param {vostok.IInitializeAck=} [properties] Properties to set
         * @returns {vostok.InitializeAck} InitializeAck instance
         */
        InitializeAck.create = function create(properties) {
            return new InitializeAck(properties);
        };

        /**
         * Encodes the specified InitializeAck message. Does not implicitly {@link vostok.InitializeAck.verify|verify} messages.
         * @function encode
         * @memberof vostok.InitializeAck
         * @static
         * @param {vostok.IInitializeAck} message InitializeAck message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        InitializeAck.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            writer.uint32(/* id 2, wireType 2 =*/18).string(message.sessionId);
            return writer;
        };

        /**
         * Encodes the specified InitializeAck message, length delimited. Does not implicitly {@link vostok.InitializeAck.verify|verify} messages.
         * @function encodeDelimited
         * @memberof vostok.InitializeAck
         * @static
         * @param {vostok.IInitializeAck} message InitializeAck message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        InitializeAck.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes an InitializeAck message from the specified reader or buffer.
         * @function decode
         * @memberof vostok.InitializeAck
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {vostok.InitializeAck} InitializeAck
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        InitializeAck.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.vostok.InitializeAck();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 2:
                    message.sessionId = reader.string();
                    break;
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            if (!message.hasOwnProperty("sessionId"))
                throw $util.ProtocolError("missing required 'sessionId'", { instance: message });
            return message;
        };

        /**
         * Decodes an InitializeAck message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof vostok.InitializeAck
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {vostok.InitializeAck} InitializeAck
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        InitializeAck.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies an InitializeAck message.
         * @function verify
         * @memberof vostok.InitializeAck
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        InitializeAck.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (!$util.isString(message.sessionId))
                return "sessionId: string expected";
            return null;
        };

        /**
         * Creates an InitializeAck message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof vostok.InitializeAck
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {vostok.InitializeAck} InitializeAck
         */
        InitializeAck.fromObject = function fromObject(object) {
            if (object instanceof $root.vostok.InitializeAck)
                return object;
            var message = new $root.vostok.InitializeAck();
            if (object.sessionId != null)
                message.sessionId = String(object.sessionId);
            return message;
        };

        /**
         * Creates a plain object from an InitializeAck message. Also converts values to other types if specified.
         * @function toObject
         * @memberof vostok.InitializeAck
         * @static
         * @param {vostok.InitializeAck} message InitializeAck
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        InitializeAck.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults)
                object.sessionId = "";
            if (message.sessionId != null && message.hasOwnProperty("sessionId"))
                object.sessionId = message.sessionId;
            return object;
        };

        /**
         * Converts this InitializeAck to JSON.
         * @function toJSON
         * @memberof vostok.InitializeAck
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        InitializeAck.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        return InitializeAck;
    })();

    vostok.InvalidMessage = (function() {

        /**
         * Properties of an InvalidMessage.
         * @memberof vostok
         * @interface IInvalidMessage
         */

        /**
         * Constructs a new InvalidMessage.
         * @memberof vostok
         * @classdesc Represents an InvalidMessage.
         * @implements IInvalidMessage
         * @constructor
         * @param {vostok.IInvalidMessage=} [properties] Properties to set
         */
        function InvalidMessage(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Creates a new InvalidMessage instance using the specified properties.
         * @function create
         * @memberof vostok.InvalidMessage
         * @static
         * @param {vostok.IInvalidMessage=} [properties] Properties to set
         * @returns {vostok.InvalidMessage} InvalidMessage instance
         */
        InvalidMessage.create = function create(properties) {
            return new InvalidMessage(properties);
        };

        /**
         * Encodes the specified InvalidMessage message. Does not implicitly {@link vostok.InvalidMessage.verify|verify} messages.
         * @function encode
         * @memberof vostok.InvalidMessage
         * @static
         * @param {vostok.IInvalidMessage} message InvalidMessage message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        InvalidMessage.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            return writer;
        };

        /**
         * Encodes the specified InvalidMessage message, length delimited. Does not implicitly {@link vostok.InvalidMessage.verify|verify} messages.
         * @function encodeDelimited
         * @memberof vostok.InvalidMessage
         * @static
         * @param {vostok.IInvalidMessage} message InvalidMessage message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        InvalidMessage.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes an InvalidMessage message from the specified reader or buffer.
         * @function decode
         * @memberof vostok.InvalidMessage
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {vostok.InvalidMessage} InvalidMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        InvalidMessage.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.vostok.InvalidMessage();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes an InvalidMessage message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof vostok.InvalidMessage
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {vostok.InvalidMessage} InvalidMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        InvalidMessage.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies an InvalidMessage message.
         * @function verify
         * @memberof vostok.InvalidMessage
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        InvalidMessage.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            return null;
        };

        /**
         * Creates an InvalidMessage message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof vostok.InvalidMessage
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {vostok.InvalidMessage} InvalidMessage
         */
        InvalidMessage.fromObject = function fromObject(object) {
            if (object instanceof $root.vostok.InvalidMessage)
                return object;
            return new $root.vostok.InvalidMessage();
        };

        /**
         * Creates a plain object from an InvalidMessage message. Also converts values to other types if specified.
         * @function toObject
         * @memberof vostok.InvalidMessage
         * @static
         * @param {vostok.InvalidMessage} message InvalidMessage
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        InvalidMessage.toObject = function toObject() {
            return {};
        };

        /**
         * Converts this InvalidMessage to JSON.
         * @function toJSON
         * @memberof vostok.InvalidMessage
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        InvalidMessage.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        return InvalidMessage;
    })();

    vostok.Ping = (function() {

        /**
         * Properties of a Ping.
         * @memberof vostok
         * @interface IPing
         * @property {number} id Ping id
         */

        /**
         * Constructs a new Ping.
         * @memberof vostok
         * @classdesc Represents a Ping.
         * @implements IPing
         * @constructor
         * @param {vostok.IPing=} [properties] Properties to set
         */
        function Ping(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Ping id.
         * @member {number} id
         * @memberof vostok.Ping
         * @instance
         */
        Ping.prototype.id = 0;

        /**
         * Creates a new Ping instance using the specified properties.
         * @function create
         * @memberof vostok.Ping
         * @static
         * @param {vostok.IPing=} [properties] Properties to set
         * @returns {vostok.Ping} Ping instance
         */
        Ping.create = function create(properties) {
            return new Ping(properties);
        };

        /**
         * Encodes the specified Ping message. Does not implicitly {@link vostok.Ping.verify|verify} messages.
         * @function encode
         * @memberof vostok.Ping
         * @static
         * @param {vostok.IPing} message Ping message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Ping.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            writer.uint32(/* id 1, wireType 0 =*/8).int32(message.id);
            return writer;
        };

        /**
         * Encodes the specified Ping message, length delimited. Does not implicitly {@link vostok.Ping.verify|verify} messages.
         * @function encodeDelimited
         * @memberof vostok.Ping
         * @static
         * @param {vostok.IPing} message Ping message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Ping.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a Ping message from the specified reader or buffer.
         * @function decode
         * @memberof vostok.Ping
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {vostok.Ping} Ping
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Ping.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.vostok.Ping();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1:
                    message.id = reader.int32();
                    break;
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            if (!message.hasOwnProperty("id"))
                throw $util.ProtocolError("missing required 'id'", { instance: message });
            return message;
        };

        /**
         * Decodes a Ping message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof vostok.Ping
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {vostok.Ping} Ping
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Ping.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a Ping message.
         * @function verify
         * @memberof vostok.Ping
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Ping.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (!$util.isInteger(message.id))
                return "id: integer expected";
            return null;
        };

        /**
         * Creates a Ping message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof vostok.Ping
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {vostok.Ping} Ping
         */
        Ping.fromObject = function fromObject(object) {
            if (object instanceof $root.vostok.Ping)
                return object;
            var message = new $root.vostok.Ping();
            if (object.id != null)
                message.id = object.id | 0;
            return message;
        };

        /**
         * Creates a plain object from a Ping message. Also converts values to other types if specified.
         * @function toObject
         * @memberof vostok.Ping
         * @static
         * @param {vostok.Ping} message Ping
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Ping.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults)
                object.id = 0;
            if (message.id != null && message.hasOwnProperty("id"))
                object.id = message.id;
            return object;
        };

        /**
         * Converts this Ping to JSON.
         * @function toJSON
         * @memberof vostok.Ping
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Ping.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        return Ping;
    })();

    vostok.Pong = (function() {

        /**
         * Properties of a Pong.
         * @memberof vostok
         * @interface IPong
         * @property {number} id Pong id
         */

        /**
         * Constructs a new Pong.
         * @memberof vostok
         * @classdesc Represents a Pong.
         * @implements IPong
         * @constructor
         * @param {vostok.IPong=} [properties] Properties to set
         */
        function Pong(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Pong id.
         * @member {number} id
         * @memberof vostok.Pong
         * @instance
         */
        Pong.prototype.id = 0;

        /**
         * Creates a new Pong instance using the specified properties.
         * @function create
         * @memberof vostok.Pong
         * @static
         * @param {vostok.IPong=} [properties] Properties to set
         * @returns {vostok.Pong} Pong instance
         */
        Pong.create = function create(properties) {
            return new Pong(properties);
        };

        /**
         * Encodes the specified Pong message. Does not implicitly {@link vostok.Pong.verify|verify} messages.
         * @function encode
         * @memberof vostok.Pong
         * @static
         * @param {vostok.IPong} message Pong message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Pong.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            writer.uint32(/* id 1, wireType 0 =*/8).int32(message.id);
            return writer;
        };

        /**
         * Encodes the specified Pong message, length delimited. Does not implicitly {@link vostok.Pong.verify|verify} messages.
         * @function encodeDelimited
         * @memberof vostok.Pong
         * @static
         * @param {vostok.IPong} message Pong message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Pong.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a Pong message from the specified reader or buffer.
         * @function decode
         * @memberof vostok.Pong
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {vostok.Pong} Pong
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Pong.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.vostok.Pong();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1:
                    message.id = reader.int32();
                    break;
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            if (!message.hasOwnProperty("id"))
                throw $util.ProtocolError("missing required 'id'", { instance: message });
            return message;
        };

        /**
         * Decodes a Pong message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof vostok.Pong
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {vostok.Pong} Pong
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Pong.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a Pong message.
         * @function verify
         * @memberof vostok.Pong
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Pong.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (!$util.isInteger(message.id))
                return "id: integer expected";
            return null;
        };

        /**
         * Creates a Pong message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof vostok.Pong
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {vostok.Pong} Pong
         */
        Pong.fromObject = function fromObject(object) {
            if (object instanceof $root.vostok.Pong)
                return object;
            var message = new $root.vostok.Pong();
            if (object.id != null)
                message.id = object.id | 0;
            return message;
        };

        /**
         * Creates a plain object from a Pong message. Also converts values to other types if specified.
         * @function toObject
         * @memberof vostok.Pong
         * @static
         * @param {vostok.Pong} message Pong
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Pong.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults)
                object.id = 0;
            if (message.id != null && message.hasOwnProperty("id"))
                object.id = message.id;
            return object;
        };

        /**
         * Converts this Pong to JSON.
         * @function toJSON
         * @memberof vostok.Pong
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Pong.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        return Pong;
    })();

    return vostok;
})();

$root.google = (function() {

    /**
     * Namespace google.
     * @exports google
     * @namespace
     */
    var google = {};

    google.protobuf = (function() {

        /**
         * Namespace protobuf.
         * @memberof google
         * @namespace
         */
        var protobuf = {};

        protobuf.Any = (function() {

            /**
             * Properties of an Any.
             * @memberof google.protobuf
             * @interface IAny
             * @property {string|null} [type_url] Any type_url
             * @property {Uint8Array|null} [value] Any value
             */

            /**
             * Constructs a new Any.
             * @memberof google.protobuf
             * @classdesc Represents an Any.
             * @implements IAny
             * @constructor
             * @param {google.protobuf.IAny=} [properties] Properties to set
             */
            function Any(properties) {
                if (properties)
                    for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * Any type_url.
             * @member {string} type_url
             * @memberof google.protobuf.Any
             * @instance
             */
            Any.prototype.type_url = "";

            /**
             * Any value.
             * @member {Uint8Array} value
             * @memberof google.protobuf.Any
             * @instance
             */
            Any.prototype.value = $util.newBuffer([]);

            /**
             * Creates a new Any instance using the specified properties.
             * @function create
             * @memberof google.protobuf.Any
             * @static
             * @param {google.protobuf.IAny=} [properties] Properties to set
             * @returns {google.protobuf.Any} Any instance
             */
            Any.create = function create(properties) {
                return new Any(properties);
            };

            /**
             * Encodes the specified Any message. Does not implicitly {@link google.protobuf.Any.verify|verify} messages.
             * @function encode
             * @memberof google.protobuf.Any
             * @static
             * @param {google.protobuf.IAny} message Any message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Any.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.type_url != null && message.hasOwnProperty("type_url"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.type_url);
                if (message.value != null && message.hasOwnProperty("value"))
                    writer.uint32(/* id 2, wireType 2 =*/18).bytes(message.value);
                return writer;
            };

            /**
             * Encodes the specified Any message, length delimited. Does not implicitly {@link google.protobuf.Any.verify|verify} messages.
             * @function encodeDelimited
             * @memberof google.protobuf.Any
             * @static
             * @param {google.protobuf.IAny} message Any message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Any.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes an Any message from the specified reader or buffer.
             * @function decode
             * @memberof google.protobuf.Any
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {google.protobuf.Any} Any
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Any.decode = function decode(reader, length) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                var end = length === undefined ? reader.len : reader.pos + length, message = new $root.google.protobuf.Any();
                while (reader.pos < end) {
                    var tag = reader.uint32();
                    switch (tag >>> 3) {
                    case 1:
                        message.type_url = reader.string();
                        break;
                    case 2:
                        message.value = reader.bytes();
                        break;
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes an Any message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof google.protobuf.Any
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {google.protobuf.Any} Any
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Any.decodeDelimited = function decodeDelimited(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies an Any message.
             * @function verify
             * @memberof google.protobuf.Any
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            Any.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.type_url != null && message.hasOwnProperty("type_url"))
                    if (!$util.isString(message.type_url))
                        return "type_url: string expected";
                if (message.value != null && message.hasOwnProperty("value"))
                    if (!(message.value && typeof message.value.length === "number" || $util.isString(message.value)))
                        return "value: buffer expected";
                return null;
            };

            /**
             * Creates an Any message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof google.protobuf.Any
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {google.protobuf.Any} Any
             */
            Any.fromObject = function fromObject(object) {
                if (object instanceof $root.google.protobuf.Any)
                    return object;
                var message = new $root.google.protobuf.Any();
                if (object.type_url != null)
                    message.type_url = String(object.type_url);
                if (object.value != null)
                    if (typeof object.value === "string")
                        $util.base64.decode(object.value, message.value = $util.newBuffer($util.base64.length(object.value)), 0);
                    else if (object.value.length)
                        message.value = object.value;
                return message;
            };

            /**
             * Creates a plain object from an Any message. Also converts values to other types if specified.
             * @function toObject
             * @memberof google.protobuf.Any
             * @static
             * @param {google.protobuf.Any} message Any
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            Any.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                var object = {};
                if (options.defaults) {
                    object.type_url = "";
                    if (options.bytes === String)
                        object.value = "";
                    else {
                        object.value = [];
                        if (options.bytes !== Array)
                            object.value = $util.newBuffer(object.value);
                    }
                }
                if (message.type_url != null && message.hasOwnProperty("type_url"))
                    object.type_url = message.type_url;
                if (message.value != null && message.hasOwnProperty("value"))
                    object.value = options.bytes === String ? $util.base64.encode(message.value, 0, message.value.length) : options.bytes === Array ? Array.prototype.slice.call(message.value) : message.value;
                return object;
            };

            /**
             * Converts this Any to JSON.
             * @function toJSON
             * @memberof google.protobuf.Any
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            Any.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            return Any;
        })();

        return protobuf;
    })();

    return google;
})();

module.exports = $root;
