/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
"use strict";

var $protobuf = require("protobufjs/minimal");

// Common aliases
var $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

$root.vostok_api = (function() {

    /**
     * Namespace vostok_api.
     * @exports vostok_api
     * @namespace
     */
    var vostok_api = {};

    vostok_api.GQLRequest = (function() {

        /**
         * Properties of a GQLRequest.
         * @memberof vostok_api
         * @interface IGQLRequest
         * @property {string} id GQLRequest id
         * @property {string|null} [operationName] GQLRequest operationName
         * @property {string} query GQLRequest query
         * @property {string|null} [variables] GQLRequest variables
         */

        /**
         * Constructs a new GQLRequest.
         * @memberof vostok_api
         * @classdesc Represents a GQLRequest.
         * @implements IGQLRequest
         * @constructor
         * @param {vostok_api.IGQLRequest=} [properties] Properties to set
         */
        function GQLRequest(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * GQLRequest id.
         * @member {string} id
         * @memberof vostok_api.GQLRequest
         * @instance
         */
        GQLRequest.prototype.id = "";

        /**
         * GQLRequest operationName.
         * @member {string} operationName
         * @memberof vostok_api.GQLRequest
         * @instance
         */
        GQLRequest.prototype.operationName = "";

        /**
         * GQLRequest query.
         * @member {string} query
         * @memberof vostok_api.GQLRequest
         * @instance
         */
        GQLRequest.prototype.query = "";

        /**
         * GQLRequest variables.
         * @member {string} variables
         * @memberof vostok_api.GQLRequest
         * @instance
         */
        GQLRequest.prototype.variables = "";

        /**
         * Creates a new GQLRequest instance using the specified properties.
         * @function create
         * @memberof vostok_api.GQLRequest
         * @static
         * @param {vostok_api.IGQLRequest=} [properties] Properties to set
         * @returns {vostok_api.GQLRequest} GQLRequest instance
         */
        GQLRequest.create = function create(properties) {
            return new GQLRequest(properties);
        };

        /**
         * Encodes the specified GQLRequest message. Does not implicitly {@link vostok_api.GQLRequest.verify|verify} messages.
         * @function encode
         * @memberof vostok_api.GQLRequest
         * @static
         * @param {vostok_api.IGQLRequest} message GQLRequest message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GQLRequest.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
            if (message.operationName != null && message.hasOwnProperty("operationName"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.operationName);
            writer.uint32(/* id 3, wireType 2 =*/26).string(message.query);
            if (message.variables != null && message.hasOwnProperty("variables"))
                writer.uint32(/* id 4, wireType 2 =*/34).string(message.variables);
            return writer;
        };

        /**
         * Encodes the specified GQLRequest message, length delimited. Does not implicitly {@link vostok_api.GQLRequest.verify|verify} messages.
         * @function encodeDelimited
         * @memberof vostok_api.GQLRequest
         * @static
         * @param {vostok_api.IGQLRequest} message GQLRequest message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GQLRequest.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a GQLRequest message from the specified reader or buffer.
         * @function decode
         * @memberof vostok_api.GQLRequest
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {vostok_api.GQLRequest} GQLRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GQLRequest.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.vostok_api.GQLRequest();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1:
                    message.id = reader.string();
                    break;
                case 2:
                    message.operationName = reader.string();
                    break;
                case 3:
                    message.query = reader.string();
                    break;
                case 4:
                    message.variables = reader.string();
                    break;
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            if (!message.hasOwnProperty("id"))
                throw $util.ProtocolError("missing required 'id'", { instance: message });
            if (!message.hasOwnProperty("query"))
                throw $util.ProtocolError("missing required 'query'", { instance: message });
            return message;
        };

        /**
         * Decodes a GQLRequest message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof vostok_api.GQLRequest
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {vostok_api.GQLRequest} GQLRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GQLRequest.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a GQLRequest message.
         * @function verify
         * @memberof vostok_api.GQLRequest
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        GQLRequest.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (!$util.isString(message.id))
                return "id: string expected";
            if (message.operationName != null && message.hasOwnProperty("operationName"))
                if (!$util.isString(message.operationName))
                    return "operationName: string expected";
            if (!$util.isString(message.query))
                return "query: string expected";
            if (message.variables != null && message.hasOwnProperty("variables"))
                if (!$util.isString(message.variables))
                    return "variables: string expected";
            return null;
        };

        /**
         * Creates a GQLRequest message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof vostok_api.GQLRequest
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {vostok_api.GQLRequest} GQLRequest
         */
        GQLRequest.fromObject = function fromObject(object) {
            if (object instanceof $root.vostok_api.GQLRequest)
                return object;
            var message = new $root.vostok_api.GQLRequest();
            if (object.id != null)
                message.id = String(object.id);
            if (object.operationName != null)
                message.operationName = String(object.operationName);
            if (object.query != null)
                message.query = String(object.query);
            if (object.variables != null)
                message.variables = String(object.variables);
            return message;
        };

        /**
         * Creates a plain object from a GQLRequest message. Also converts values to other types if specified.
         * @function toObject
         * @memberof vostok_api.GQLRequest
         * @static
         * @param {vostok_api.GQLRequest} message GQLRequest
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        GQLRequest.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.id = "";
                object.operationName = "";
                object.query = "";
                object.variables = "";
            }
            if (message.id != null && message.hasOwnProperty("id"))
                object.id = message.id;
            if (message.operationName != null && message.hasOwnProperty("operationName"))
                object.operationName = message.operationName;
            if (message.query != null && message.hasOwnProperty("query"))
                object.query = message.query;
            if (message.variables != null && message.hasOwnProperty("variables"))
                object.variables = message.variables;
            return object;
        };

        /**
         * Converts this GQLRequest to JSON.
         * @function toJSON
         * @memberof vostok_api.GQLRequest
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        GQLRequest.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        return GQLRequest;
    })();

    vostok_api.GQLResponse = (function() {

        /**
         * Properties of a GQLResponse.
         * @memberof vostok_api
         * @interface IGQLResponse
         * @property {string} id GQLResponse id
         * @property {string} result GQLResponse result
         */

        /**
         * Constructs a new GQLResponse.
         * @memberof vostok_api
         * @classdesc Represents a GQLResponse.
         * @implements IGQLResponse
         * @constructor
         * @param {vostok_api.IGQLResponse=} [properties] Properties to set
         */
        function GQLResponse(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * GQLResponse id.
         * @member {string} id
         * @memberof vostok_api.GQLResponse
         * @instance
         */
        GQLResponse.prototype.id = "";

        /**
         * GQLResponse result.
         * @member {string} result
         * @memberof vostok_api.GQLResponse
         * @instance
         */
        GQLResponse.prototype.result = "";

        /**
         * Creates a new GQLResponse instance using the specified properties.
         * @function create
         * @memberof vostok_api.GQLResponse
         * @static
         * @param {vostok_api.IGQLResponse=} [properties] Properties to set
         * @returns {vostok_api.GQLResponse} GQLResponse instance
         */
        GQLResponse.create = function create(properties) {
            return new GQLResponse(properties);
        };

        /**
         * Encodes the specified GQLResponse message. Does not implicitly {@link vostok_api.GQLResponse.verify|verify} messages.
         * @function encode
         * @memberof vostok_api.GQLResponse
         * @static
         * @param {vostok_api.IGQLResponse} message GQLResponse message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GQLResponse.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
            writer.uint32(/* id 2, wireType 2 =*/18).string(message.result);
            return writer;
        };

        /**
         * Encodes the specified GQLResponse message, length delimited. Does not implicitly {@link vostok_api.GQLResponse.verify|verify} messages.
         * @function encodeDelimited
         * @memberof vostok_api.GQLResponse
         * @static
         * @param {vostok_api.IGQLResponse} message GQLResponse message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GQLResponse.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a GQLResponse message from the specified reader or buffer.
         * @function decode
         * @memberof vostok_api.GQLResponse
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {vostok_api.GQLResponse} GQLResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GQLResponse.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.vostok_api.GQLResponse();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1:
                    message.id = reader.string();
                    break;
                case 2:
                    message.result = reader.string();
                    break;
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            if (!message.hasOwnProperty("id"))
                throw $util.ProtocolError("missing required 'id'", { instance: message });
            if (!message.hasOwnProperty("result"))
                throw $util.ProtocolError("missing required 'result'", { instance: message });
            return message;
        };

        /**
         * Decodes a GQLResponse message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof vostok_api.GQLResponse
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {vostok_api.GQLResponse} GQLResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GQLResponse.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a GQLResponse message.
         * @function verify
         * @memberof vostok_api.GQLResponse
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        GQLResponse.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (!$util.isString(message.id))
                return "id: string expected";
            if (!$util.isString(message.result))
                return "result: string expected";
            return null;
        };

        /**
         * Creates a GQLResponse message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof vostok_api.GQLResponse
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {vostok_api.GQLResponse} GQLResponse
         */
        GQLResponse.fromObject = function fromObject(object) {
            if (object instanceof $root.vostok_api.GQLResponse)
                return object;
            var message = new $root.vostok_api.GQLResponse();
            if (object.id != null)
                message.id = String(object.id);
            if (object.result != null)
                message.result = String(object.result);
            return message;
        };

        /**
         * Creates a plain object from a GQLResponse message. Also converts values to other types if specified.
         * @function toObject
         * @memberof vostok_api.GQLResponse
         * @static
         * @param {vostok_api.GQLResponse} message GQLResponse
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        GQLResponse.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.id = "";
                object.result = "";
            }
            if (message.id != null && message.hasOwnProperty("id"))
                object.id = message.id;
            if (message.result != null && message.hasOwnProperty("result"))
                object.result = message.result;
            return object;
        };

        /**
         * Converts this GQLResponse to JSON.
         * @function toJSON
         * @memberof vostok_api.GQLResponse
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        GQLResponse.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        return GQLResponse;
    })();

    vostok_api.GQLSubscription = (function() {

        /**
         * Properties of a GQLSubscription.
         * @memberof vostok_api
         * @interface IGQLSubscription
         * @property {string} id GQLSubscription id
         * @property {string|null} [operationName] GQLSubscription operationName
         * @property {string} query GQLSubscription query
         * @property {string|null} [variables] GQLSubscription variables
         */

        /**
         * Constructs a new GQLSubscription.
         * @memberof vostok_api
         * @classdesc Represents a GQLSubscription.
         * @implements IGQLSubscription
         * @constructor
         * @param {vostok_api.IGQLSubscription=} [properties] Properties to set
         */
        function GQLSubscription(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * GQLSubscription id.
         * @member {string} id
         * @memberof vostok_api.GQLSubscription
         * @instance
         */
        GQLSubscription.prototype.id = "";

        /**
         * GQLSubscription operationName.
         * @member {string} operationName
         * @memberof vostok_api.GQLSubscription
         * @instance
         */
        GQLSubscription.prototype.operationName = "";

        /**
         * GQLSubscription query.
         * @member {string} query
         * @memberof vostok_api.GQLSubscription
         * @instance
         */
        GQLSubscription.prototype.query = "";

        /**
         * GQLSubscription variables.
         * @member {string} variables
         * @memberof vostok_api.GQLSubscription
         * @instance
         */
        GQLSubscription.prototype.variables = "";

        /**
         * Creates a new GQLSubscription instance using the specified properties.
         * @function create
         * @memberof vostok_api.GQLSubscription
         * @static
         * @param {vostok_api.IGQLSubscription=} [properties] Properties to set
         * @returns {vostok_api.GQLSubscription} GQLSubscription instance
         */
        GQLSubscription.create = function create(properties) {
            return new GQLSubscription(properties);
        };

        /**
         * Encodes the specified GQLSubscription message. Does not implicitly {@link vostok_api.GQLSubscription.verify|verify} messages.
         * @function encode
         * @memberof vostok_api.GQLSubscription
         * @static
         * @param {vostok_api.IGQLSubscription} message GQLSubscription message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GQLSubscription.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
            if (message.operationName != null && message.hasOwnProperty("operationName"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.operationName);
            writer.uint32(/* id 3, wireType 2 =*/26).string(message.query);
            if (message.variables != null && message.hasOwnProperty("variables"))
                writer.uint32(/* id 4, wireType 2 =*/34).string(message.variables);
            return writer;
        };

        /**
         * Encodes the specified GQLSubscription message, length delimited. Does not implicitly {@link vostok_api.GQLSubscription.verify|verify} messages.
         * @function encodeDelimited
         * @memberof vostok_api.GQLSubscription
         * @static
         * @param {vostok_api.IGQLSubscription} message GQLSubscription message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GQLSubscription.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a GQLSubscription message from the specified reader or buffer.
         * @function decode
         * @memberof vostok_api.GQLSubscription
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {vostok_api.GQLSubscription} GQLSubscription
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GQLSubscription.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.vostok_api.GQLSubscription();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1:
                    message.id = reader.string();
                    break;
                case 2:
                    message.operationName = reader.string();
                    break;
                case 3:
                    message.query = reader.string();
                    break;
                case 4:
                    message.variables = reader.string();
                    break;
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            if (!message.hasOwnProperty("id"))
                throw $util.ProtocolError("missing required 'id'", { instance: message });
            if (!message.hasOwnProperty("query"))
                throw $util.ProtocolError("missing required 'query'", { instance: message });
            return message;
        };

        /**
         * Decodes a GQLSubscription message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof vostok_api.GQLSubscription
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {vostok_api.GQLSubscription} GQLSubscription
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GQLSubscription.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a GQLSubscription message.
         * @function verify
         * @memberof vostok_api.GQLSubscription
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        GQLSubscription.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (!$util.isString(message.id))
                return "id: string expected";
            if (message.operationName != null && message.hasOwnProperty("operationName"))
                if (!$util.isString(message.operationName))
                    return "operationName: string expected";
            if (!$util.isString(message.query))
                return "query: string expected";
            if (message.variables != null && message.hasOwnProperty("variables"))
                if (!$util.isString(message.variables))
                    return "variables: string expected";
            return null;
        };

        /**
         * Creates a GQLSubscription message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof vostok_api.GQLSubscription
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {vostok_api.GQLSubscription} GQLSubscription
         */
        GQLSubscription.fromObject = function fromObject(object) {
            if (object instanceof $root.vostok_api.GQLSubscription)
                return object;
            var message = new $root.vostok_api.GQLSubscription();
            if (object.id != null)
                message.id = String(object.id);
            if (object.operationName != null)
                message.operationName = String(object.operationName);
            if (object.query != null)
                message.query = String(object.query);
            if (object.variables != null)
                message.variables = String(object.variables);
            return message;
        };

        /**
         * Creates a plain object from a GQLSubscription message. Also converts values to other types if specified.
         * @function toObject
         * @memberof vostok_api.GQLSubscription
         * @static
         * @param {vostok_api.GQLSubscription} message GQLSubscription
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        GQLSubscription.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.id = "";
                object.operationName = "";
                object.query = "";
                object.variables = "";
            }
            if (message.id != null && message.hasOwnProperty("id"))
                object.id = message.id;
            if (message.operationName != null && message.hasOwnProperty("operationName"))
                object.operationName = message.operationName;
            if (message.query != null && message.hasOwnProperty("query"))
                object.query = message.query;
            if (message.variables != null && message.hasOwnProperty("variables"))
                object.variables = message.variables;
            return object;
        };

        /**
         * Converts this GQLSubscription to JSON.
         * @function toJSON
         * @memberof vostok_api.GQLSubscription
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        GQLSubscription.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        return GQLSubscription;
    })();

    vostok_api.GQLSubscriptionStop = (function() {

        /**
         * Properties of a GQLSubscriptionStop.
         * @memberof vostok_api
         * @interface IGQLSubscriptionStop
         * @property {string} id GQLSubscriptionStop id
         */

        /**
         * Constructs a new GQLSubscriptionStop.
         * @memberof vostok_api
         * @classdesc Represents a GQLSubscriptionStop.
         * @implements IGQLSubscriptionStop
         * @constructor
         * @param {vostok_api.IGQLSubscriptionStop=} [properties] Properties to set
         */
        function GQLSubscriptionStop(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * GQLSubscriptionStop id.
         * @member {string} id
         * @memberof vostok_api.GQLSubscriptionStop
         * @instance
         */
        GQLSubscriptionStop.prototype.id = "";

        /**
         * Creates a new GQLSubscriptionStop instance using the specified properties.
         * @function create
         * @memberof vostok_api.GQLSubscriptionStop
         * @static
         * @param {vostok_api.IGQLSubscriptionStop=} [properties] Properties to set
         * @returns {vostok_api.GQLSubscriptionStop} GQLSubscriptionStop instance
         */
        GQLSubscriptionStop.create = function create(properties) {
            return new GQLSubscriptionStop(properties);
        };

        /**
         * Encodes the specified GQLSubscriptionStop message. Does not implicitly {@link vostok_api.GQLSubscriptionStop.verify|verify} messages.
         * @function encode
         * @memberof vostok_api.GQLSubscriptionStop
         * @static
         * @param {vostok_api.IGQLSubscriptionStop} message GQLSubscriptionStop message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GQLSubscriptionStop.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
            return writer;
        };

        /**
         * Encodes the specified GQLSubscriptionStop message, length delimited. Does not implicitly {@link vostok_api.GQLSubscriptionStop.verify|verify} messages.
         * @function encodeDelimited
         * @memberof vostok_api.GQLSubscriptionStop
         * @static
         * @param {vostok_api.IGQLSubscriptionStop} message GQLSubscriptionStop message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GQLSubscriptionStop.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a GQLSubscriptionStop message from the specified reader or buffer.
         * @function decode
         * @memberof vostok_api.GQLSubscriptionStop
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {vostok_api.GQLSubscriptionStop} GQLSubscriptionStop
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GQLSubscriptionStop.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.vostok_api.GQLSubscriptionStop();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1:
                    message.id = reader.string();
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
         * Decodes a GQLSubscriptionStop message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof vostok_api.GQLSubscriptionStop
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {vostok_api.GQLSubscriptionStop} GQLSubscriptionStop
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GQLSubscriptionStop.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a GQLSubscriptionStop message.
         * @function verify
         * @memberof vostok_api.GQLSubscriptionStop
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        GQLSubscriptionStop.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (!$util.isString(message.id))
                return "id: string expected";
            return null;
        };

        /**
         * Creates a GQLSubscriptionStop message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof vostok_api.GQLSubscriptionStop
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {vostok_api.GQLSubscriptionStop} GQLSubscriptionStop
         */
        GQLSubscriptionStop.fromObject = function fromObject(object) {
            if (object instanceof $root.vostok_api.GQLSubscriptionStop)
                return object;
            var message = new $root.vostok_api.GQLSubscriptionStop();
            if (object.id != null)
                message.id = String(object.id);
            return message;
        };

        /**
         * Creates a plain object from a GQLSubscriptionStop message. Also converts values to other types if specified.
         * @function toObject
         * @memberof vostok_api.GQLSubscriptionStop
         * @static
         * @param {vostok_api.GQLSubscriptionStop} message GQLSubscriptionStop
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        GQLSubscriptionStop.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults)
                object.id = "";
            if (message.id != null && message.hasOwnProperty("id"))
                object.id = message.id;
            return object;
        };

        /**
         * Converts this GQLSubscriptionStop to JSON.
         * @function toJSON
         * @memberof vostok_api.GQLSubscriptionStop
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        GQLSubscriptionStop.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        return GQLSubscriptionStop;
    })();

    vostok_api.GQLSubscriptionResponse = (function() {

        /**
         * Properties of a GQLSubscriptionResponse.
         * @memberof vostok_api
         * @interface IGQLSubscriptionResponse
         * @property {string} id GQLSubscriptionResponse id
         * @property {string} result GQLSubscriptionResponse result
         */

        /**
         * Constructs a new GQLSubscriptionResponse.
         * @memberof vostok_api
         * @classdesc Represents a GQLSubscriptionResponse.
         * @implements IGQLSubscriptionResponse
         * @constructor
         * @param {vostok_api.IGQLSubscriptionResponse=} [properties] Properties to set
         */
        function GQLSubscriptionResponse(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * GQLSubscriptionResponse id.
         * @member {string} id
         * @memberof vostok_api.GQLSubscriptionResponse
         * @instance
         */
        GQLSubscriptionResponse.prototype.id = "";

        /**
         * GQLSubscriptionResponse result.
         * @member {string} result
         * @memberof vostok_api.GQLSubscriptionResponse
         * @instance
         */
        GQLSubscriptionResponse.prototype.result = "";

        /**
         * Creates a new GQLSubscriptionResponse instance using the specified properties.
         * @function create
         * @memberof vostok_api.GQLSubscriptionResponse
         * @static
         * @param {vostok_api.IGQLSubscriptionResponse=} [properties] Properties to set
         * @returns {vostok_api.GQLSubscriptionResponse} GQLSubscriptionResponse instance
         */
        GQLSubscriptionResponse.create = function create(properties) {
            return new GQLSubscriptionResponse(properties);
        };

        /**
         * Encodes the specified GQLSubscriptionResponse message. Does not implicitly {@link vostok_api.GQLSubscriptionResponse.verify|verify} messages.
         * @function encode
         * @memberof vostok_api.GQLSubscriptionResponse
         * @static
         * @param {vostok_api.IGQLSubscriptionResponse} message GQLSubscriptionResponse message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GQLSubscriptionResponse.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
            writer.uint32(/* id 2, wireType 2 =*/18).string(message.result);
            return writer;
        };

        /**
         * Encodes the specified GQLSubscriptionResponse message, length delimited. Does not implicitly {@link vostok_api.GQLSubscriptionResponse.verify|verify} messages.
         * @function encodeDelimited
         * @memberof vostok_api.GQLSubscriptionResponse
         * @static
         * @param {vostok_api.IGQLSubscriptionResponse} message GQLSubscriptionResponse message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GQLSubscriptionResponse.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a GQLSubscriptionResponse message from the specified reader or buffer.
         * @function decode
         * @memberof vostok_api.GQLSubscriptionResponse
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {vostok_api.GQLSubscriptionResponse} GQLSubscriptionResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GQLSubscriptionResponse.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.vostok_api.GQLSubscriptionResponse();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1:
                    message.id = reader.string();
                    break;
                case 2:
                    message.result = reader.string();
                    break;
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            if (!message.hasOwnProperty("id"))
                throw $util.ProtocolError("missing required 'id'", { instance: message });
            if (!message.hasOwnProperty("result"))
                throw $util.ProtocolError("missing required 'result'", { instance: message });
            return message;
        };

        /**
         * Decodes a GQLSubscriptionResponse message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof vostok_api.GQLSubscriptionResponse
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {vostok_api.GQLSubscriptionResponse} GQLSubscriptionResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GQLSubscriptionResponse.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a GQLSubscriptionResponse message.
         * @function verify
         * @memberof vostok_api.GQLSubscriptionResponse
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        GQLSubscriptionResponse.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (!$util.isString(message.id))
                return "id: string expected";
            if (!$util.isString(message.result))
                return "result: string expected";
            return null;
        };

        /**
         * Creates a GQLSubscriptionResponse message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof vostok_api.GQLSubscriptionResponse
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {vostok_api.GQLSubscriptionResponse} GQLSubscriptionResponse
         */
        GQLSubscriptionResponse.fromObject = function fromObject(object) {
            if (object instanceof $root.vostok_api.GQLSubscriptionResponse)
                return object;
            var message = new $root.vostok_api.GQLSubscriptionResponse();
            if (object.id != null)
                message.id = String(object.id);
            if (object.result != null)
                message.result = String(object.result);
            return message;
        };

        /**
         * Creates a plain object from a GQLSubscriptionResponse message. Also converts values to other types if specified.
         * @function toObject
         * @memberof vostok_api.GQLSubscriptionResponse
         * @static
         * @param {vostok_api.GQLSubscriptionResponse} message GQLSubscriptionResponse
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        GQLSubscriptionResponse.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.id = "";
                object.result = "";
            }
            if (message.id != null && message.hasOwnProperty("id"))
                object.id = message.id;
            if (message.result != null && message.hasOwnProperty("result"))
                object.result = message.result;
            return object;
        };

        /**
         * Converts this GQLSubscriptionResponse to JSON.
         * @function toJSON
         * @memberof vostok_api.GQLSubscriptionResponse
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        GQLSubscriptionResponse.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        return GQLSubscriptionResponse;
    })();

    vostok_api.GQLSubscriptionComplete = (function() {

        /**
         * Properties of a GQLSubscriptionComplete.
         * @memberof vostok_api
         * @interface IGQLSubscriptionComplete
         * @property {string} id GQLSubscriptionComplete id
         */

        /**
         * Constructs a new GQLSubscriptionComplete.
         * @memberof vostok_api
         * @classdesc Represents a GQLSubscriptionComplete.
         * @implements IGQLSubscriptionComplete
         * @constructor
         * @param {vostok_api.IGQLSubscriptionComplete=} [properties] Properties to set
         */
        function GQLSubscriptionComplete(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * GQLSubscriptionComplete id.
         * @member {string} id
         * @memberof vostok_api.GQLSubscriptionComplete
         * @instance
         */
        GQLSubscriptionComplete.prototype.id = "";

        /**
         * Creates a new GQLSubscriptionComplete instance using the specified properties.
         * @function create
         * @memberof vostok_api.GQLSubscriptionComplete
         * @static
         * @param {vostok_api.IGQLSubscriptionComplete=} [properties] Properties to set
         * @returns {vostok_api.GQLSubscriptionComplete} GQLSubscriptionComplete instance
         */
        GQLSubscriptionComplete.create = function create(properties) {
            return new GQLSubscriptionComplete(properties);
        };

        /**
         * Encodes the specified GQLSubscriptionComplete message. Does not implicitly {@link vostok_api.GQLSubscriptionComplete.verify|verify} messages.
         * @function encode
         * @memberof vostok_api.GQLSubscriptionComplete
         * @static
         * @param {vostok_api.IGQLSubscriptionComplete} message GQLSubscriptionComplete message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GQLSubscriptionComplete.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
            return writer;
        };

        /**
         * Encodes the specified GQLSubscriptionComplete message, length delimited. Does not implicitly {@link vostok_api.GQLSubscriptionComplete.verify|verify} messages.
         * @function encodeDelimited
         * @memberof vostok_api.GQLSubscriptionComplete
         * @static
         * @param {vostok_api.IGQLSubscriptionComplete} message GQLSubscriptionComplete message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GQLSubscriptionComplete.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a GQLSubscriptionComplete message from the specified reader or buffer.
         * @function decode
         * @memberof vostok_api.GQLSubscriptionComplete
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {vostok_api.GQLSubscriptionComplete} GQLSubscriptionComplete
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GQLSubscriptionComplete.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.vostok_api.GQLSubscriptionComplete();
            while (reader.pos < end) {
                var tag = reader.uint32();
                switch (tag >>> 3) {
                case 1:
                    message.id = reader.string();
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
         * Decodes a GQLSubscriptionComplete message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof vostok_api.GQLSubscriptionComplete
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {vostok_api.GQLSubscriptionComplete} GQLSubscriptionComplete
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GQLSubscriptionComplete.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a GQLSubscriptionComplete message.
         * @function verify
         * @memberof vostok_api.GQLSubscriptionComplete
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        GQLSubscriptionComplete.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (!$util.isString(message.id))
                return "id: string expected";
            return null;
        };

        /**
         * Creates a GQLSubscriptionComplete message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof vostok_api.GQLSubscriptionComplete
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {vostok_api.GQLSubscriptionComplete} GQLSubscriptionComplete
         */
        GQLSubscriptionComplete.fromObject = function fromObject(object) {
            if (object instanceof $root.vostok_api.GQLSubscriptionComplete)
                return object;
            var message = new $root.vostok_api.GQLSubscriptionComplete();
            if (object.id != null)
                message.id = String(object.id);
            return message;
        };

        /**
         * Creates a plain object from a GQLSubscriptionComplete message. Also converts values to other types if specified.
         * @function toObject
         * @memberof vostok_api.GQLSubscriptionComplete
         * @static
         * @param {vostok_api.GQLSubscriptionComplete} message GQLSubscriptionComplete
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        GQLSubscriptionComplete.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults)
                object.id = "";
            if (message.id != null && message.hasOwnProperty("id"))
                object.id = message.id;
            return object;
        };

        /**
         * Converts this GQLSubscriptionComplete to JSON.
         * @function toJSON
         * @memberof vostok_api.GQLSubscriptionComplete
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        GQLSubscriptionComplete.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        return GQLSubscriptionComplete;
    })();

    return vostok_api;
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
