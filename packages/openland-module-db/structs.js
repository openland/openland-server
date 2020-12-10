/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
"use strict";

var $protobuf = require("protobufjs/minimal");

// Common aliases
var $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

$root.TreeNode = (function() {

    /**
     * Properties of a TreeNode.
     * @exports ITreeNode
     * @interface ITreeNode
     * @property {number} id TreeNode id
     * @property {number|null} [parent] TreeNode parent
     * @property {TreeNodeType} type TreeNode type
     * @property {Array.<number>|null} [values] TreeNode values
     * @property {Array.<INodeChildren>|null} [children] TreeNode children
     */

    /**
     * Constructs a new TreeNode.
     * @exports TreeNode
     * @classdesc Represents a TreeNode.
     * @implements ITreeNode
     * @constructor
     * @param {ITreeNode=} [properties] Properties to set
     */
    function TreeNode(properties) {
        this.values = [];
        this.children = [];
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * TreeNode id.
     * @member {number} id
     * @memberof TreeNode
     * @instance
     */
    TreeNode.prototype.id = 0;

    /**
     * TreeNode parent.
     * @member {number} parent
     * @memberof TreeNode
     * @instance
     */
    TreeNode.prototype.parent = 0;

    /**
     * TreeNode type.
     * @member {TreeNodeType} type
     * @memberof TreeNode
     * @instance
     */
    TreeNode.prototype.type = 0;

    /**
     * TreeNode values.
     * @member {Array.<number>} values
     * @memberof TreeNode
     * @instance
     */
    TreeNode.prototype.values = $util.emptyArray;

    /**
     * TreeNode children.
     * @member {Array.<INodeChildren>} children
     * @memberof TreeNode
     * @instance
     */
    TreeNode.prototype.children = $util.emptyArray;

    /**
     * Creates a new TreeNode instance using the specified properties.
     * @function create
     * @memberof TreeNode
     * @static
     * @param {ITreeNode=} [properties] Properties to set
     * @returns {TreeNode} TreeNode instance
     */
    TreeNode.create = function create(properties) {
        return new TreeNode(properties);
    };

    /**
     * Encodes the specified TreeNode message. Does not implicitly {@link TreeNode.verify|verify} messages.
     * @function encode
     * @memberof TreeNode
     * @static
     * @param {ITreeNode} message TreeNode message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    TreeNode.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        writer.uint32(/* id 0, wireType 0 =*/0).int32(message.id);
        if (message.parent != null && Object.hasOwnProperty.call(message, "parent"))
            writer.uint32(/* id 1, wireType 0 =*/8).int32(message.parent);
        writer.uint32(/* id 2, wireType 0 =*/16).int32(message.type);
        if (message.values != null && message.values.length) {
            writer.uint32(/* id 3, wireType 2 =*/26).fork();
            for (var i = 0; i < message.values.length; ++i)
                writer.int32(message.values[i]);
            writer.ldelim();
        }
        if (message.children != null && message.children.length)
            for (var i = 0; i < message.children.length; ++i)
                $root.NodeChildren.encode(message.children[i], writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified TreeNode message, length delimited. Does not implicitly {@link TreeNode.verify|verify} messages.
     * @function encodeDelimited
     * @memberof TreeNode
     * @static
     * @param {ITreeNode} message TreeNode message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    TreeNode.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a TreeNode message from the specified reader or buffer.
     * @function decode
     * @memberof TreeNode
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {TreeNode} TreeNode
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    TreeNode.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.TreeNode();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 0:
                message.id = reader.int32();
                break;
            case 1:
                message.parent = reader.int32();
                break;
            case 2:
                message.type = reader.int32();
                break;
            case 3:
                if (!(message.values && message.values.length))
                    message.values = [];
                if ((tag & 7) === 2) {
                    var end2 = reader.uint32() + reader.pos;
                    while (reader.pos < end2)
                        message.values.push(reader.int32());
                } else
                    message.values.push(reader.int32());
                break;
            case 4:
                if (!(message.children && message.children.length))
                    message.children = [];
                message.children.push($root.NodeChildren.decode(reader, reader.uint32()));
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        if (!message.hasOwnProperty("id"))
            throw $util.ProtocolError("missing required 'id'", { instance: message });
        if (!message.hasOwnProperty("type"))
            throw $util.ProtocolError("missing required 'type'", { instance: message });
        return message;
    };

    /**
     * Decodes a TreeNode message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof TreeNode
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {TreeNode} TreeNode
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    TreeNode.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a TreeNode message.
     * @function verify
     * @memberof TreeNode
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    TreeNode.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (!$util.isInteger(message.id))
            return "id: integer expected";
        if (message.parent != null && message.hasOwnProperty("parent"))
            if (!$util.isInteger(message.parent))
                return "parent: integer expected";
        switch (message.type) {
        default:
            return "type: enum value expected";
        case 0:
        case 1:
            break;
        }
        if (message.values != null && message.hasOwnProperty("values")) {
            if (!Array.isArray(message.values))
                return "values: array expected";
            for (var i = 0; i < message.values.length; ++i)
                if (!$util.isInteger(message.values[i]))
                    return "values: integer[] expected";
        }
        if (message.children != null && message.hasOwnProperty("children")) {
            if (!Array.isArray(message.children))
                return "children: array expected";
            for (var i = 0; i < message.children.length; ++i) {
                var error = $root.NodeChildren.verify(message.children[i]);
                if (error)
                    return "children." + error;
            }
        }
        return null;
    };

    /**
     * Creates a TreeNode message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof TreeNode
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {TreeNode} TreeNode
     */
    TreeNode.fromObject = function fromObject(object) {
        if (object instanceof $root.TreeNode)
            return object;
        var message = new $root.TreeNode();
        if (object.id != null)
            message.id = object.id | 0;
        if (object.parent != null)
            message.parent = object.parent | 0;
        switch (object.type) {
        case "LEAF":
        case 0:
            message.type = 0;
            break;
        case "INNER":
        case 1:
            message.type = 1;
            break;
        }
        if (object.values) {
            if (!Array.isArray(object.values))
                throw TypeError(".TreeNode.values: array expected");
            message.values = [];
            for (var i = 0; i < object.values.length; ++i)
                message.values[i] = object.values[i] | 0;
        }
        if (object.children) {
            if (!Array.isArray(object.children))
                throw TypeError(".TreeNode.children: array expected");
            message.children = [];
            for (var i = 0; i < object.children.length; ++i) {
                if (typeof object.children[i] !== "object")
                    throw TypeError(".TreeNode.children: object expected");
                message.children[i] = $root.NodeChildren.fromObject(object.children[i]);
            }
        }
        return message;
    };

    /**
     * Creates a plain object from a TreeNode message. Also converts values to other types if specified.
     * @function toObject
     * @memberof TreeNode
     * @static
     * @param {TreeNode} message TreeNode
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    TreeNode.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.arrays || options.defaults) {
            object.values = [];
            object.children = [];
        }
        if (options.defaults) {
            object.id = 0;
            object.parent = 0;
            object.type = options.enums === String ? "LEAF" : 0;
        }
        if (message.id != null && message.hasOwnProperty("id"))
            object.id = message.id;
        if (message.parent != null && message.hasOwnProperty("parent"))
            object.parent = message.parent;
        if (message.type != null && message.hasOwnProperty("type"))
            object.type = options.enums === String ? $root.TreeNodeType[message.type] : message.type;
        if (message.values && message.values.length) {
            object.values = [];
            for (var j = 0; j < message.values.length; ++j)
                object.values[j] = message.values[j];
        }
        if (message.children && message.children.length) {
            object.children = [];
            for (var j = 0; j < message.children.length; ++j)
                object.children[j] = $root.NodeChildren.toObject(message.children[j], options);
        }
        return object;
    };

    /**
     * Converts this TreeNode to JSON.
     * @function toJSON
     * @memberof TreeNode
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    TreeNode.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return TreeNode;
})();

$root.NodeChildren = (function() {

    /**
     * Properties of a NodeChildren.
     * @exports INodeChildren
     * @interface INodeChildren
     * @property {number} id NodeChildren id
     * @property {number} max NodeChildren max
     * @property {number} min NodeChildren min
     * @property {number} count NodeChildren count
     */

    /**
     * Constructs a new NodeChildren.
     * @exports NodeChildren
     * @classdesc Represents a NodeChildren.
     * @implements INodeChildren
     * @constructor
     * @param {INodeChildren=} [properties] Properties to set
     */
    function NodeChildren(properties) {
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * NodeChildren id.
     * @member {number} id
     * @memberof NodeChildren
     * @instance
     */
    NodeChildren.prototype.id = 0;

    /**
     * NodeChildren max.
     * @member {number} max
     * @memberof NodeChildren
     * @instance
     */
    NodeChildren.prototype.max = 0;

    /**
     * NodeChildren min.
     * @member {number} min
     * @memberof NodeChildren
     * @instance
     */
    NodeChildren.prototype.min = 0;

    /**
     * NodeChildren count.
     * @member {number} count
     * @memberof NodeChildren
     * @instance
     */
    NodeChildren.prototype.count = 0;

    /**
     * Creates a new NodeChildren instance using the specified properties.
     * @function create
     * @memberof NodeChildren
     * @static
     * @param {INodeChildren=} [properties] Properties to set
     * @returns {NodeChildren} NodeChildren instance
     */
    NodeChildren.create = function create(properties) {
        return new NodeChildren(properties);
    };

    /**
     * Encodes the specified NodeChildren message. Does not implicitly {@link NodeChildren.verify|verify} messages.
     * @function encode
     * @memberof NodeChildren
     * @static
     * @param {INodeChildren} message NodeChildren message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    NodeChildren.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        writer.uint32(/* id 0, wireType 0 =*/0).int32(message.id);
        writer.uint32(/* id 1, wireType 0 =*/8).int32(message.max);
        writer.uint32(/* id 2, wireType 0 =*/16).int32(message.min);
        writer.uint32(/* id 3, wireType 0 =*/24).int32(message.count);
        return writer;
    };

    /**
     * Encodes the specified NodeChildren message, length delimited. Does not implicitly {@link NodeChildren.verify|verify} messages.
     * @function encodeDelimited
     * @memberof NodeChildren
     * @static
     * @param {INodeChildren} message NodeChildren message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    NodeChildren.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a NodeChildren message from the specified reader or buffer.
     * @function decode
     * @memberof NodeChildren
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {NodeChildren} NodeChildren
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    NodeChildren.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.NodeChildren();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 0:
                message.id = reader.int32();
                break;
            case 1:
                message.max = reader.int32();
                break;
            case 2:
                message.min = reader.int32();
                break;
            case 3:
                message.count = reader.int32();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        if (!message.hasOwnProperty("id"))
            throw $util.ProtocolError("missing required 'id'", { instance: message });
        if (!message.hasOwnProperty("max"))
            throw $util.ProtocolError("missing required 'max'", { instance: message });
        if (!message.hasOwnProperty("min"))
            throw $util.ProtocolError("missing required 'min'", { instance: message });
        if (!message.hasOwnProperty("count"))
            throw $util.ProtocolError("missing required 'count'", { instance: message });
        return message;
    };

    /**
     * Decodes a NodeChildren message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof NodeChildren
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {NodeChildren} NodeChildren
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    NodeChildren.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a NodeChildren message.
     * @function verify
     * @memberof NodeChildren
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    NodeChildren.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (!$util.isInteger(message.id))
            return "id: integer expected";
        if (!$util.isInteger(message.max))
            return "max: integer expected";
        if (!$util.isInteger(message.min))
            return "min: integer expected";
        if (!$util.isInteger(message.count))
            return "count: integer expected";
        return null;
    };

    /**
     * Creates a NodeChildren message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof NodeChildren
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {NodeChildren} NodeChildren
     */
    NodeChildren.fromObject = function fromObject(object) {
        if (object instanceof $root.NodeChildren)
            return object;
        var message = new $root.NodeChildren();
        if (object.id != null)
            message.id = object.id | 0;
        if (object.max != null)
            message.max = object.max | 0;
        if (object.min != null)
            message.min = object.min | 0;
        if (object.count != null)
            message.count = object.count | 0;
        return message;
    };

    /**
     * Creates a plain object from a NodeChildren message. Also converts values to other types if specified.
     * @function toObject
     * @memberof NodeChildren
     * @static
     * @param {NodeChildren} message NodeChildren
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    NodeChildren.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.defaults) {
            object.id = 0;
            object.max = 0;
            object.min = 0;
            object.count = 0;
        }
        if (message.id != null && message.hasOwnProperty("id"))
            object.id = message.id;
        if (message.max != null && message.hasOwnProperty("max"))
            object.max = message.max;
        if (message.min != null && message.hasOwnProperty("min"))
            object.min = message.min;
        if (message.count != null && message.hasOwnProperty("count"))
            object.count = message.count;
        return object;
    };

    /**
     * Converts this NodeChildren to JSON.
     * @function toJSON
     * @memberof NodeChildren
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    NodeChildren.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return NodeChildren;
})();

$root.TreeHead = (function() {

    /**
     * Properties of a TreeHead.
     * @exports ITreeHead
     * @interface ITreeHead
     * @property {number} counter TreeHead counter
     * @property {number|null} [root] TreeHead root
     */

    /**
     * Constructs a new TreeHead.
     * @exports TreeHead
     * @classdesc Represents a TreeHead.
     * @implements ITreeHead
     * @constructor
     * @param {ITreeHead=} [properties] Properties to set
     */
    function TreeHead(properties) {
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * TreeHead counter.
     * @member {number} counter
     * @memberof TreeHead
     * @instance
     */
    TreeHead.prototype.counter = 0;

    /**
     * TreeHead root.
     * @member {number} root
     * @memberof TreeHead
     * @instance
     */
    TreeHead.prototype.root = 0;

    /**
     * Creates a new TreeHead instance using the specified properties.
     * @function create
     * @memberof TreeHead
     * @static
     * @param {ITreeHead=} [properties] Properties to set
     * @returns {TreeHead} TreeHead instance
     */
    TreeHead.create = function create(properties) {
        return new TreeHead(properties);
    };

    /**
     * Encodes the specified TreeHead message. Does not implicitly {@link TreeHead.verify|verify} messages.
     * @function encode
     * @memberof TreeHead
     * @static
     * @param {ITreeHead} message TreeHead message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    TreeHead.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        writer.uint32(/* id 1, wireType 0 =*/8).int32(message.counter);
        if (message.root != null && Object.hasOwnProperty.call(message, "root"))
            writer.uint32(/* id 2, wireType 0 =*/16).int32(message.root);
        return writer;
    };

    /**
     * Encodes the specified TreeHead message, length delimited. Does not implicitly {@link TreeHead.verify|verify} messages.
     * @function encodeDelimited
     * @memberof TreeHead
     * @static
     * @param {ITreeHead} message TreeHead message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    TreeHead.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a TreeHead message from the specified reader or buffer.
     * @function decode
     * @memberof TreeHead
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {TreeHead} TreeHead
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    TreeHead.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.TreeHead();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.counter = reader.int32();
                break;
            case 2:
                message.root = reader.int32();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        if (!message.hasOwnProperty("counter"))
            throw $util.ProtocolError("missing required 'counter'", { instance: message });
        return message;
    };

    /**
     * Decodes a TreeHead message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof TreeHead
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {TreeHead} TreeHead
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    TreeHead.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a TreeHead message.
     * @function verify
     * @memberof TreeHead
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    TreeHead.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (!$util.isInteger(message.counter))
            return "counter: integer expected";
        if (message.root != null && message.hasOwnProperty("root"))
            if (!$util.isInteger(message.root))
                return "root: integer expected";
        return null;
    };

    /**
     * Creates a TreeHead message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof TreeHead
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {TreeHead} TreeHead
     */
    TreeHead.fromObject = function fromObject(object) {
        if (object instanceof $root.TreeHead)
            return object;
        var message = new $root.TreeHead();
        if (object.counter != null)
            message.counter = object.counter | 0;
        if (object.root != null)
            message.root = object.root | 0;
        return message;
    };

    /**
     * Creates a plain object from a TreeHead message. Also converts values to other types if specified.
     * @function toObject
     * @memberof TreeHead
     * @static
     * @param {TreeHead} message TreeHead
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    TreeHead.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.defaults) {
            object.counter = 0;
            object.root = 0;
        }
        if (message.counter != null && message.hasOwnProperty("counter"))
            object.counter = message.counter;
        if (message.root != null && message.hasOwnProperty("root"))
            object.root = message.root;
        return object;
    };

    /**
     * Converts this TreeHead to JSON.
     * @function toJSON
     * @memberof TreeHead
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    TreeHead.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return TreeHead;
})();

$root.CountersMessageRef = (function() {

    /**
     * Properties of a CountersMessageRef.
     * @exports ICountersMessageRef
     * @interface ICountersMessageRef
     * @property {number} sender CountersMessageRef sender
     * @property {Array.<number>|null} [mentions] CountersMessageRef mentions
     * @property {boolean} allMention CountersMessageRef allMention
     * @property {Array.<number>|null} [visibleOnlyTo] CountersMessageRef visibleOnlyTo
     */

    /**
     * Constructs a new CountersMessageRef.
     * @exports CountersMessageRef
     * @classdesc Represents a CountersMessageRef.
     * @implements ICountersMessageRef
     * @constructor
     * @param {ICountersMessageRef=} [properties] Properties to set
     */
    function CountersMessageRef(properties) {
        this.mentions = [];
        this.visibleOnlyTo = [];
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * CountersMessageRef sender.
     * @member {number} sender
     * @memberof CountersMessageRef
     * @instance
     */
    CountersMessageRef.prototype.sender = 0;

    /**
     * CountersMessageRef mentions.
     * @member {Array.<number>} mentions
     * @memberof CountersMessageRef
     * @instance
     */
    CountersMessageRef.prototype.mentions = $util.emptyArray;

    /**
     * CountersMessageRef allMention.
     * @member {boolean} allMention
     * @memberof CountersMessageRef
     * @instance
     */
    CountersMessageRef.prototype.allMention = false;

    /**
     * CountersMessageRef visibleOnlyTo.
     * @member {Array.<number>} visibleOnlyTo
     * @memberof CountersMessageRef
     * @instance
     */
    CountersMessageRef.prototype.visibleOnlyTo = $util.emptyArray;

    /**
     * Creates a new CountersMessageRef instance using the specified properties.
     * @function create
     * @memberof CountersMessageRef
     * @static
     * @param {ICountersMessageRef=} [properties] Properties to set
     * @returns {CountersMessageRef} CountersMessageRef instance
     */
    CountersMessageRef.create = function create(properties) {
        return new CountersMessageRef(properties);
    };

    /**
     * Encodes the specified CountersMessageRef message. Does not implicitly {@link CountersMessageRef.verify|verify} messages.
     * @function encode
     * @memberof CountersMessageRef
     * @static
     * @param {ICountersMessageRef} message CountersMessageRef message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    CountersMessageRef.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        writer.uint32(/* id 0, wireType 0 =*/0).int32(message.sender);
        if (message.mentions != null && message.mentions.length) {
            writer.uint32(/* id 1, wireType 2 =*/10).fork();
            for (var i = 0; i < message.mentions.length; ++i)
                writer.int32(message.mentions[i]);
            writer.ldelim();
        }
        writer.uint32(/* id 2, wireType 0 =*/16).bool(message.allMention);
        if (message.visibleOnlyTo != null && message.visibleOnlyTo.length) {
            writer.uint32(/* id 3, wireType 2 =*/26).fork();
            for (var i = 0; i < message.visibleOnlyTo.length; ++i)
                writer.int32(message.visibleOnlyTo[i]);
            writer.ldelim();
        }
        return writer;
    };

    /**
     * Encodes the specified CountersMessageRef message, length delimited. Does not implicitly {@link CountersMessageRef.verify|verify} messages.
     * @function encodeDelimited
     * @memberof CountersMessageRef
     * @static
     * @param {ICountersMessageRef} message CountersMessageRef message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    CountersMessageRef.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a CountersMessageRef message from the specified reader or buffer.
     * @function decode
     * @memberof CountersMessageRef
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {CountersMessageRef} CountersMessageRef
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    CountersMessageRef.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.CountersMessageRef();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 0:
                message.sender = reader.int32();
                break;
            case 1:
                if (!(message.mentions && message.mentions.length))
                    message.mentions = [];
                if ((tag & 7) === 2) {
                    var end2 = reader.uint32() + reader.pos;
                    while (reader.pos < end2)
                        message.mentions.push(reader.int32());
                } else
                    message.mentions.push(reader.int32());
                break;
            case 2:
                message.allMention = reader.bool();
                break;
            case 3:
                if (!(message.visibleOnlyTo && message.visibleOnlyTo.length))
                    message.visibleOnlyTo = [];
                if ((tag & 7) === 2) {
                    var end2 = reader.uint32() + reader.pos;
                    while (reader.pos < end2)
                        message.visibleOnlyTo.push(reader.int32());
                } else
                    message.visibleOnlyTo.push(reader.int32());
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        if (!message.hasOwnProperty("sender"))
            throw $util.ProtocolError("missing required 'sender'", { instance: message });
        if (!message.hasOwnProperty("allMention"))
            throw $util.ProtocolError("missing required 'allMention'", { instance: message });
        return message;
    };

    /**
     * Decodes a CountersMessageRef message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof CountersMessageRef
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {CountersMessageRef} CountersMessageRef
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    CountersMessageRef.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a CountersMessageRef message.
     * @function verify
     * @memberof CountersMessageRef
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    CountersMessageRef.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (!$util.isInteger(message.sender))
            return "sender: integer expected";
        if (message.mentions != null && message.hasOwnProperty("mentions")) {
            if (!Array.isArray(message.mentions))
                return "mentions: array expected";
            for (var i = 0; i < message.mentions.length; ++i)
                if (!$util.isInteger(message.mentions[i]))
                    return "mentions: integer[] expected";
        }
        if (typeof message.allMention !== "boolean")
            return "allMention: boolean expected";
        if (message.visibleOnlyTo != null && message.hasOwnProperty("visibleOnlyTo")) {
            if (!Array.isArray(message.visibleOnlyTo))
                return "visibleOnlyTo: array expected";
            for (var i = 0; i < message.visibleOnlyTo.length; ++i)
                if (!$util.isInteger(message.visibleOnlyTo[i]))
                    return "visibleOnlyTo: integer[] expected";
        }
        return null;
    };

    /**
     * Creates a CountersMessageRef message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof CountersMessageRef
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {CountersMessageRef} CountersMessageRef
     */
    CountersMessageRef.fromObject = function fromObject(object) {
        if (object instanceof $root.CountersMessageRef)
            return object;
        var message = new $root.CountersMessageRef();
        if (object.sender != null)
            message.sender = object.sender | 0;
        if (object.mentions) {
            if (!Array.isArray(object.mentions))
                throw TypeError(".CountersMessageRef.mentions: array expected");
            message.mentions = [];
            for (var i = 0; i < object.mentions.length; ++i)
                message.mentions[i] = object.mentions[i] | 0;
        }
        if (object.allMention != null)
            message.allMention = Boolean(object.allMention);
        if (object.visibleOnlyTo) {
            if (!Array.isArray(object.visibleOnlyTo))
                throw TypeError(".CountersMessageRef.visibleOnlyTo: array expected");
            message.visibleOnlyTo = [];
            for (var i = 0; i < object.visibleOnlyTo.length; ++i)
                message.visibleOnlyTo[i] = object.visibleOnlyTo[i] | 0;
        }
        return message;
    };

    /**
     * Creates a plain object from a CountersMessageRef message. Also converts values to other types if specified.
     * @function toObject
     * @memberof CountersMessageRef
     * @static
     * @param {CountersMessageRef} message CountersMessageRef
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    CountersMessageRef.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.arrays || options.defaults) {
            object.mentions = [];
            object.visibleOnlyTo = [];
        }
        if (options.defaults) {
            object.sender = 0;
            object.allMention = false;
        }
        if (message.sender != null && message.hasOwnProperty("sender"))
            object.sender = message.sender;
        if (message.mentions && message.mentions.length) {
            object.mentions = [];
            for (var j = 0; j < message.mentions.length; ++j)
                object.mentions[j] = message.mentions[j];
        }
        if (message.allMention != null && message.hasOwnProperty("allMention"))
            object.allMention = message.allMention;
        if (message.visibleOnlyTo && message.visibleOnlyTo.length) {
            object.visibleOnlyTo = [];
            for (var j = 0; j < message.visibleOnlyTo.length; ++j)
                object.visibleOnlyTo[j] = message.visibleOnlyTo[j];
        }
        return object;
    };

    /**
     * Converts this CountersMessageRef to JSON.
     * @function toJSON
     * @memberof CountersMessageRef
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    CountersMessageRef.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return CountersMessageRef;
})();

/**
 * TreeNodeType enum.
 * @exports TreeNodeType
 * @enum {number}
 * @property {number} LEAF=0 LEAF value
 * @property {number} INNER=1 INNER value
 */
$root.TreeNodeType = (function() {
    var valuesById = {}, values = Object.create(valuesById);
    values[valuesById[0] = "LEAF"] = 0;
    values[valuesById[1] = "INNER"] = 1;
    return values;
})();

module.exports = $root;
