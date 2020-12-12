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

$root.DirectCounterRefs = (function() {

    /**
     * Properties of a DirectCounterRefs.
     * @exports IDirectCounterRefs
     * @interface IDirectCounterRefs
     * @property {Array.<IDirectCounterRef>|null} [refs] DirectCounterRefs refs
     */

    /**
     * Constructs a new DirectCounterRefs.
     * @exports DirectCounterRefs
     * @classdesc Represents a DirectCounterRefs.
     * @implements IDirectCounterRefs
     * @constructor
     * @param {IDirectCounterRefs=} [properties] Properties to set
     */
    function DirectCounterRefs(properties) {
        this.refs = [];
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * DirectCounterRefs refs.
     * @member {Array.<IDirectCounterRef>} refs
     * @memberof DirectCounterRefs
     * @instance
     */
    DirectCounterRefs.prototype.refs = $util.emptyArray;

    /**
     * Creates a new DirectCounterRefs instance using the specified properties.
     * @function create
     * @memberof DirectCounterRefs
     * @static
     * @param {IDirectCounterRefs=} [properties] Properties to set
     * @returns {DirectCounterRefs} DirectCounterRefs instance
     */
    DirectCounterRefs.create = function create(properties) {
        return new DirectCounterRefs(properties);
    };

    /**
     * Encodes the specified DirectCounterRefs message. Does not implicitly {@link DirectCounterRefs.verify|verify} messages.
     * @function encode
     * @memberof DirectCounterRefs
     * @static
     * @param {IDirectCounterRefs} message DirectCounterRefs message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    DirectCounterRefs.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.refs != null && message.refs.length)
            for (var i = 0; i < message.refs.length; ++i)
                $root.DirectCounterRef.encode(message.refs[i], writer.uint32(/* id 0, wireType 2 =*/2).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified DirectCounterRefs message, length delimited. Does not implicitly {@link DirectCounterRefs.verify|verify} messages.
     * @function encodeDelimited
     * @memberof DirectCounterRefs
     * @static
     * @param {IDirectCounterRefs} message DirectCounterRefs message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    DirectCounterRefs.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a DirectCounterRefs message from the specified reader or buffer.
     * @function decode
     * @memberof DirectCounterRefs
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {DirectCounterRefs} DirectCounterRefs
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    DirectCounterRefs.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.DirectCounterRefs();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 0:
                if (!(message.refs && message.refs.length))
                    message.refs = [];
                message.refs.push($root.DirectCounterRef.decode(reader, reader.uint32()));
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a DirectCounterRefs message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof DirectCounterRefs
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {DirectCounterRefs} DirectCounterRefs
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    DirectCounterRefs.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a DirectCounterRefs message.
     * @function verify
     * @memberof DirectCounterRefs
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    DirectCounterRefs.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.refs != null && message.hasOwnProperty("refs")) {
            if (!Array.isArray(message.refs))
                return "refs: array expected";
            for (var i = 0; i < message.refs.length; ++i) {
                var error = $root.DirectCounterRef.verify(message.refs[i]);
                if (error)
                    return "refs." + error;
            }
        }
        return null;
    };

    /**
     * Creates a DirectCounterRefs message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof DirectCounterRefs
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {DirectCounterRefs} DirectCounterRefs
     */
    DirectCounterRefs.fromObject = function fromObject(object) {
        if (object instanceof $root.DirectCounterRefs)
            return object;
        var message = new $root.DirectCounterRefs();
        if (object.refs) {
            if (!Array.isArray(object.refs))
                throw TypeError(".DirectCounterRefs.refs: array expected");
            message.refs = [];
            for (var i = 0; i < object.refs.length; ++i) {
                if (typeof object.refs[i] !== "object")
                    throw TypeError(".DirectCounterRefs.refs: object expected");
                message.refs[i] = $root.DirectCounterRef.fromObject(object.refs[i]);
            }
        }
        return message;
    };

    /**
     * Creates a plain object from a DirectCounterRefs message. Also converts values to other types if specified.
     * @function toObject
     * @memberof DirectCounterRefs
     * @static
     * @param {DirectCounterRefs} message DirectCounterRefs
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    DirectCounterRefs.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.arrays || options.defaults)
            object.refs = [];
        if (message.refs && message.refs.length) {
            object.refs = [];
            for (var j = 0; j < message.refs.length; ++j)
                object.refs[j] = $root.DirectCounterRef.toObject(message.refs[j], options);
        }
        return object;
    };

    /**
     * Converts this DirectCounterRefs to JSON.
     * @function toJSON
     * @memberof DirectCounterRefs
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    DirectCounterRefs.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return DirectCounterRefs;
})();

$root.DirectCounterRef = (function() {

    /**
     * Properties of a DirectCounterRef.
     * @exports IDirectCounterRef
     * @interface IDirectCounterRef
     * @property {number} uid DirectCounterRef uid
     * @property {number} seq DirectCounterRef seq
     * @property {number} counter DirectCounterRef counter
     * @property {number} mentions DirectCounterRef mentions
     */

    /**
     * Constructs a new DirectCounterRef.
     * @exports DirectCounterRef
     * @classdesc Represents a DirectCounterRef.
     * @implements IDirectCounterRef
     * @constructor
     * @param {IDirectCounterRef=} [properties] Properties to set
     */
    function DirectCounterRef(properties) {
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * DirectCounterRef uid.
     * @member {number} uid
     * @memberof DirectCounterRef
     * @instance
     */
    DirectCounterRef.prototype.uid = 0;

    /**
     * DirectCounterRef seq.
     * @member {number} seq
     * @memberof DirectCounterRef
     * @instance
     */
    DirectCounterRef.prototype.seq = 0;

    /**
     * DirectCounterRef counter.
     * @member {number} counter
     * @memberof DirectCounterRef
     * @instance
     */
    DirectCounterRef.prototype.counter = 0;

    /**
     * DirectCounterRef mentions.
     * @member {number} mentions
     * @memberof DirectCounterRef
     * @instance
     */
    DirectCounterRef.prototype.mentions = 0;

    /**
     * Creates a new DirectCounterRef instance using the specified properties.
     * @function create
     * @memberof DirectCounterRef
     * @static
     * @param {IDirectCounterRef=} [properties] Properties to set
     * @returns {DirectCounterRef} DirectCounterRef instance
     */
    DirectCounterRef.create = function create(properties) {
        return new DirectCounterRef(properties);
    };

    /**
     * Encodes the specified DirectCounterRef message. Does not implicitly {@link DirectCounterRef.verify|verify} messages.
     * @function encode
     * @memberof DirectCounterRef
     * @static
     * @param {IDirectCounterRef} message DirectCounterRef message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    DirectCounterRef.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        writer.uint32(/* id 0, wireType 0 =*/0).int32(message.uid);
        writer.uint32(/* id 1, wireType 0 =*/8).int32(message.seq);
        writer.uint32(/* id 2, wireType 0 =*/16).int32(message.counter);
        writer.uint32(/* id 3, wireType 0 =*/24).int32(message.mentions);
        return writer;
    };

    /**
     * Encodes the specified DirectCounterRef message, length delimited. Does not implicitly {@link DirectCounterRef.verify|verify} messages.
     * @function encodeDelimited
     * @memberof DirectCounterRef
     * @static
     * @param {IDirectCounterRef} message DirectCounterRef message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    DirectCounterRef.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a DirectCounterRef message from the specified reader or buffer.
     * @function decode
     * @memberof DirectCounterRef
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {DirectCounterRef} DirectCounterRef
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    DirectCounterRef.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.DirectCounterRef();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 0:
                message.uid = reader.int32();
                break;
            case 1:
                message.seq = reader.int32();
                break;
            case 2:
                message.counter = reader.int32();
                break;
            case 3:
                message.mentions = reader.int32();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        if (!message.hasOwnProperty("uid"))
            throw $util.ProtocolError("missing required 'uid'", { instance: message });
        if (!message.hasOwnProperty("seq"))
            throw $util.ProtocolError("missing required 'seq'", { instance: message });
        if (!message.hasOwnProperty("counter"))
            throw $util.ProtocolError("missing required 'counter'", { instance: message });
        if (!message.hasOwnProperty("mentions"))
            throw $util.ProtocolError("missing required 'mentions'", { instance: message });
        return message;
    };

    /**
     * Decodes a DirectCounterRef message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof DirectCounterRef
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {DirectCounterRef} DirectCounterRef
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    DirectCounterRef.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a DirectCounterRef message.
     * @function verify
     * @memberof DirectCounterRef
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    DirectCounterRef.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (!$util.isInteger(message.uid))
            return "uid: integer expected";
        if (!$util.isInteger(message.seq))
            return "seq: integer expected";
        if (!$util.isInteger(message.counter))
            return "counter: integer expected";
        if (!$util.isInteger(message.mentions))
            return "mentions: integer expected";
        return null;
    };

    /**
     * Creates a DirectCounterRef message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof DirectCounterRef
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {DirectCounterRef} DirectCounterRef
     */
    DirectCounterRef.fromObject = function fromObject(object) {
        if (object instanceof $root.DirectCounterRef)
            return object;
        var message = new $root.DirectCounterRef();
        if (object.uid != null)
            message.uid = object.uid | 0;
        if (object.seq != null)
            message.seq = object.seq | 0;
        if (object.counter != null)
            message.counter = object.counter | 0;
        if (object.mentions != null)
            message.mentions = object.mentions | 0;
        return message;
    };

    /**
     * Creates a plain object from a DirectCounterRef message. Also converts values to other types if specified.
     * @function toObject
     * @memberof DirectCounterRef
     * @static
     * @param {DirectCounterRef} message DirectCounterRef
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    DirectCounterRef.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.defaults) {
            object.uid = 0;
            object.seq = 0;
            object.counter = 0;
            object.mentions = 0;
        }
        if (message.uid != null && message.hasOwnProperty("uid"))
            object.uid = message.uid;
        if (message.seq != null && message.hasOwnProperty("seq"))
            object.seq = message.seq;
        if (message.counter != null && message.hasOwnProperty("counter"))
            object.counter = message.counter;
        if (message.mentions != null && message.hasOwnProperty("mentions"))
            object.mentions = message.mentions;
        return object;
    };

    /**
     * Converts this DirectCounterRef to JSON.
     * @function toJSON
     * @memberof DirectCounterRef
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    DirectCounterRef.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return DirectCounterRef;
})();

$root.ConversationCountersState = (function() {

    /**
     * Properties of a ConversationCountersState.
     * @exports IConversationCountersState
     * @interface IConversationCountersState
     * @property {Array.<number>|null} [direct] ConversationCountersState direct
     */

    /**
     * Constructs a new ConversationCountersState.
     * @exports ConversationCountersState
     * @classdesc Represents a ConversationCountersState.
     * @implements IConversationCountersState
     * @constructor
     * @param {IConversationCountersState=} [properties] Properties to set
     */
    function ConversationCountersState(properties) {
        this.direct = [];
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * ConversationCountersState direct.
     * @member {Array.<number>} direct
     * @memberof ConversationCountersState
     * @instance
     */
    ConversationCountersState.prototype.direct = $util.emptyArray;

    /**
     * Creates a new ConversationCountersState instance using the specified properties.
     * @function create
     * @memberof ConversationCountersState
     * @static
     * @param {IConversationCountersState=} [properties] Properties to set
     * @returns {ConversationCountersState} ConversationCountersState instance
     */
    ConversationCountersState.create = function create(properties) {
        return new ConversationCountersState(properties);
    };

    /**
     * Encodes the specified ConversationCountersState message. Does not implicitly {@link ConversationCountersState.verify|verify} messages.
     * @function encode
     * @memberof ConversationCountersState
     * @static
     * @param {IConversationCountersState} message ConversationCountersState message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ConversationCountersState.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.direct != null && message.direct.length) {
            writer.uint32(/* id 0, wireType 2 =*/2).fork();
            for (var i = 0; i < message.direct.length; ++i)
                writer.int32(message.direct[i]);
            writer.ldelim();
        }
        return writer;
    };

    /**
     * Encodes the specified ConversationCountersState message, length delimited. Does not implicitly {@link ConversationCountersState.verify|verify} messages.
     * @function encodeDelimited
     * @memberof ConversationCountersState
     * @static
     * @param {IConversationCountersState} message ConversationCountersState message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ConversationCountersState.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a ConversationCountersState message from the specified reader or buffer.
     * @function decode
     * @memberof ConversationCountersState
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {ConversationCountersState} ConversationCountersState
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ConversationCountersState.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.ConversationCountersState();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 0:
                if (!(message.direct && message.direct.length))
                    message.direct = [];
                if ((tag & 7) === 2) {
                    var end2 = reader.uint32() + reader.pos;
                    while (reader.pos < end2)
                        message.direct.push(reader.int32());
                } else
                    message.direct.push(reader.int32());
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a ConversationCountersState message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof ConversationCountersState
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {ConversationCountersState} ConversationCountersState
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ConversationCountersState.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a ConversationCountersState message.
     * @function verify
     * @memberof ConversationCountersState
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    ConversationCountersState.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.direct != null && message.hasOwnProperty("direct")) {
            if (!Array.isArray(message.direct))
                return "direct: array expected";
            for (var i = 0; i < message.direct.length; ++i)
                if (!$util.isInteger(message.direct[i]))
                    return "direct: integer[] expected";
        }
        return null;
    };

    /**
     * Creates a ConversationCountersState message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof ConversationCountersState
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {ConversationCountersState} ConversationCountersState
     */
    ConversationCountersState.fromObject = function fromObject(object) {
        if (object instanceof $root.ConversationCountersState)
            return object;
        var message = new $root.ConversationCountersState();
        if (object.direct) {
            if (!Array.isArray(object.direct))
                throw TypeError(".ConversationCountersState.direct: array expected");
            message.direct = [];
            for (var i = 0; i < object.direct.length; ++i)
                message.direct[i] = object.direct[i] | 0;
        }
        return message;
    };

    /**
     * Creates a plain object from a ConversationCountersState message. Also converts values to other types if specified.
     * @function toObject
     * @memberof ConversationCountersState
     * @static
     * @param {ConversationCountersState} message ConversationCountersState
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    ConversationCountersState.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.arrays || options.defaults)
            object.direct = [];
        if (message.direct && message.direct.length) {
            object.direct = [];
            for (var j = 0; j < message.direct.length; ++j)
                object.direct[j] = message.direct[j];
        }
        return object;
    };

    /**
     * Converts this ConversationCountersState to JSON.
     * @function toJSON
     * @memberof ConversationCountersState
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    ConversationCountersState.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return ConversationCountersState;
})();

$root.UserCounterState = (function() {

    /**
     * Properties of a UserCounterState.
     * @exports IUserCounterState
     * @interface IUserCounterState
     * @property {number} seq UserCounterState seq
     * @property {boolean} muted UserCounterState muted
     * @property {boolean} async UserCounterState async
     * @property {number|null} [counter] UserCounterState counter
     * @property {number|null} [mentions] UserCounterState mentions
     */

    /**
     * Constructs a new UserCounterState.
     * @exports UserCounterState
     * @classdesc Represents a UserCounterState.
     * @implements IUserCounterState
     * @constructor
     * @param {IUserCounterState=} [properties] Properties to set
     */
    function UserCounterState(properties) {
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * UserCounterState seq.
     * @member {number} seq
     * @memberof UserCounterState
     * @instance
     */
    UserCounterState.prototype.seq = 0;

    /**
     * UserCounterState muted.
     * @member {boolean} muted
     * @memberof UserCounterState
     * @instance
     */
    UserCounterState.prototype.muted = false;

    /**
     * UserCounterState async.
     * @member {boolean} async
     * @memberof UserCounterState
     * @instance
     */
    UserCounterState.prototype.async = false;

    /**
     * UserCounterState counter.
     * @member {number} counter
     * @memberof UserCounterState
     * @instance
     */
    UserCounterState.prototype.counter = 0;

    /**
     * UserCounterState mentions.
     * @member {number} mentions
     * @memberof UserCounterState
     * @instance
     */
    UserCounterState.prototype.mentions = 0;

    /**
     * Creates a new UserCounterState instance using the specified properties.
     * @function create
     * @memberof UserCounterState
     * @static
     * @param {IUserCounterState=} [properties] Properties to set
     * @returns {UserCounterState} UserCounterState instance
     */
    UserCounterState.create = function create(properties) {
        return new UserCounterState(properties);
    };

    /**
     * Encodes the specified UserCounterState message. Does not implicitly {@link UserCounterState.verify|verify} messages.
     * @function encode
     * @memberof UserCounterState
     * @static
     * @param {IUserCounterState} message UserCounterState message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    UserCounterState.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        writer.uint32(/* id 1, wireType 0 =*/8).int32(message.seq);
        writer.uint32(/* id 2, wireType 0 =*/16).bool(message.muted);
        writer.uint32(/* id 3, wireType 0 =*/24).bool(message.async);
        if (message.counter != null && Object.hasOwnProperty.call(message, "counter"))
            writer.uint32(/* id 4, wireType 0 =*/32).int32(message.counter);
        if (message.mentions != null && Object.hasOwnProperty.call(message, "mentions"))
            writer.uint32(/* id 5, wireType 0 =*/40).int32(message.mentions);
        return writer;
    };

    /**
     * Encodes the specified UserCounterState message, length delimited. Does not implicitly {@link UserCounterState.verify|verify} messages.
     * @function encodeDelimited
     * @memberof UserCounterState
     * @static
     * @param {IUserCounterState} message UserCounterState message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    UserCounterState.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a UserCounterState message from the specified reader or buffer.
     * @function decode
     * @memberof UserCounterState
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {UserCounterState} UserCounterState
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UserCounterState.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.UserCounterState();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.seq = reader.int32();
                break;
            case 2:
                message.muted = reader.bool();
                break;
            case 3:
                message.async = reader.bool();
                break;
            case 4:
                message.counter = reader.int32();
                break;
            case 5:
                message.mentions = reader.int32();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        if (!message.hasOwnProperty("seq"))
            throw $util.ProtocolError("missing required 'seq'", { instance: message });
        if (!message.hasOwnProperty("muted"))
            throw $util.ProtocolError("missing required 'muted'", { instance: message });
        if (!message.hasOwnProperty("async"))
            throw $util.ProtocolError("missing required 'async'", { instance: message });
        return message;
    };

    /**
     * Decodes a UserCounterState message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof UserCounterState
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {UserCounterState} UserCounterState
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UserCounterState.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a UserCounterState message.
     * @function verify
     * @memberof UserCounterState
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    UserCounterState.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (!$util.isInteger(message.seq))
            return "seq: integer expected";
        if (typeof message.muted !== "boolean")
            return "muted: boolean expected";
        if (typeof message.async !== "boolean")
            return "async: boolean expected";
        if (message.counter != null && message.hasOwnProperty("counter"))
            if (!$util.isInteger(message.counter))
                return "counter: integer expected";
        if (message.mentions != null && message.hasOwnProperty("mentions"))
            if (!$util.isInteger(message.mentions))
                return "mentions: integer expected";
        return null;
    };

    /**
     * Creates a UserCounterState message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof UserCounterState
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {UserCounterState} UserCounterState
     */
    UserCounterState.fromObject = function fromObject(object) {
        if (object instanceof $root.UserCounterState)
            return object;
        var message = new $root.UserCounterState();
        if (object.seq != null)
            message.seq = object.seq | 0;
        if (object.muted != null)
            message.muted = Boolean(object.muted);
        if (object.async != null)
            message.async = Boolean(object.async);
        if (object.counter != null)
            message.counter = object.counter | 0;
        if (object.mentions != null)
            message.mentions = object.mentions | 0;
        return message;
    };

    /**
     * Creates a plain object from a UserCounterState message. Also converts values to other types if specified.
     * @function toObject
     * @memberof UserCounterState
     * @static
     * @param {UserCounterState} message UserCounterState
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    UserCounterState.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.defaults) {
            object.seq = 0;
            object.muted = false;
            object.async = false;
            object.counter = 0;
            object.mentions = 0;
        }
        if (message.seq != null && message.hasOwnProperty("seq"))
            object.seq = message.seq;
        if (message.muted != null && message.hasOwnProperty("muted"))
            object.muted = message.muted;
        if (message.async != null && message.hasOwnProperty("async"))
            object.async = message.async;
        if (message.counter != null && message.hasOwnProperty("counter"))
            object.counter = message.counter;
        if (message.mentions != null && message.hasOwnProperty("mentions"))
            object.mentions = message.mentions;
        return object;
    };

    /**
     * Converts this UserCounterState to JSON.
     * @function toJSON
     * @memberof UserCounterState
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    UserCounterState.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return UserCounterState;
})();

$root.UserSubscriptionState = (function() {

    /**
     * Properties of a UserSubscriptionState.
     * @exports IUserSubscriptionState
     * @interface IUserSubscriptionState
     * @property {number} cid UserSubscriptionState cid
     * @property {boolean} muted UserSubscriptionState muted
     * @property {number} seq UserSubscriptionState seq
     */

    /**
     * Constructs a new UserSubscriptionState.
     * @exports UserSubscriptionState
     * @classdesc Represents a UserSubscriptionState.
     * @implements IUserSubscriptionState
     * @constructor
     * @param {IUserSubscriptionState=} [properties] Properties to set
     */
    function UserSubscriptionState(properties) {
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * UserSubscriptionState cid.
     * @member {number} cid
     * @memberof UserSubscriptionState
     * @instance
     */
    UserSubscriptionState.prototype.cid = 0;

    /**
     * UserSubscriptionState muted.
     * @member {boolean} muted
     * @memberof UserSubscriptionState
     * @instance
     */
    UserSubscriptionState.prototype.muted = false;

    /**
     * UserSubscriptionState seq.
     * @member {number} seq
     * @memberof UserSubscriptionState
     * @instance
     */
    UserSubscriptionState.prototype.seq = 0;

    /**
     * Creates a new UserSubscriptionState instance using the specified properties.
     * @function create
     * @memberof UserSubscriptionState
     * @static
     * @param {IUserSubscriptionState=} [properties] Properties to set
     * @returns {UserSubscriptionState} UserSubscriptionState instance
     */
    UserSubscriptionState.create = function create(properties) {
        return new UserSubscriptionState(properties);
    };

    /**
     * Encodes the specified UserSubscriptionState message. Does not implicitly {@link UserSubscriptionState.verify|verify} messages.
     * @function encode
     * @memberof UserSubscriptionState
     * @static
     * @param {IUserSubscriptionState} message UserSubscriptionState message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    UserSubscriptionState.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        writer.uint32(/* id 1, wireType 0 =*/8).int32(message.cid);
        writer.uint32(/* id 2, wireType 0 =*/16).bool(message.muted);
        writer.uint32(/* id 3, wireType 0 =*/24).int32(message.seq);
        return writer;
    };

    /**
     * Encodes the specified UserSubscriptionState message, length delimited. Does not implicitly {@link UserSubscriptionState.verify|verify} messages.
     * @function encodeDelimited
     * @memberof UserSubscriptionState
     * @static
     * @param {IUserSubscriptionState} message UserSubscriptionState message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    UserSubscriptionState.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a UserSubscriptionState message from the specified reader or buffer.
     * @function decode
     * @memberof UserSubscriptionState
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {UserSubscriptionState} UserSubscriptionState
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UserSubscriptionState.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.UserSubscriptionState();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                message.cid = reader.int32();
                break;
            case 2:
                message.muted = reader.bool();
                break;
            case 3:
                message.seq = reader.int32();
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        if (!message.hasOwnProperty("cid"))
            throw $util.ProtocolError("missing required 'cid'", { instance: message });
        if (!message.hasOwnProperty("muted"))
            throw $util.ProtocolError("missing required 'muted'", { instance: message });
        if (!message.hasOwnProperty("seq"))
            throw $util.ProtocolError("missing required 'seq'", { instance: message });
        return message;
    };

    /**
     * Decodes a UserSubscriptionState message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof UserSubscriptionState
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {UserSubscriptionState} UserSubscriptionState
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UserSubscriptionState.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a UserSubscriptionState message.
     * @function verify
     * @memberof UserSubscriptionState
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    UserSubscriptionState.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (!$util.isInteger(message.cid))
            return "cid: integer expected";
        if (typeof message.muted !== "boolean")
            return "muted: boolean expected";
        if (!$util.isInteger(message.seq))
            return "seq: integer expected";
        return null;
    };

    /**
     * Creates a UserSubscriptionState message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof UserSubscriptionState
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {UserSubscriptionState} UserSubscriptionState
     */
    UserSubscriptionState.fromObject = function fromObject(object) {
        if (object instanceof $root.UserSubscriptionState)
            return object;
        var message = new $root.UserSubscriptionState();
        if (object.cid != null)
            message.cid = object.cid | 0;
        if (object.muted != null)
            message.muted = Boolean(object.muted);
        if (object.seq != null)
            message.seq = object.seq | 0;
        return message;
    };

    /**
     * Creates a plain object from a UserSubscriptionState message. Also converts values to other types if specified.
     * @function toObject
     * @memberof UserSubscriptionState
     * @static
     * @param {UserSubscriptionState} message UserSubscriptionState
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    UserSubscriptionState.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.defaults) {
            object.cid = 0;
            object.muted = false;
            object.seq = 0;
        }
        if (message.cid != null && message.hasOwnProperty("cid"))
            object.cid = message.cid;
        if (message.muted != null && message.hasOwnProperty("muted"))
            object.muted = message.muted;
        if (message.seq != null && message.hasOwnProperty("seq"))
            object.seq = message.seq;
        return object;
    };

    /**
     * Converts this UserSubscriptionState to JSON.
     * @function toJSON
     * @memberof UserSubscriptionState
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    UserSubscriptionState.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return UserSubscriptionState;
})();

$root.UserCounterAsyncSubscriptions = (function() {

    /**
     * Properties of a UserCounterAsyncSubscriptions.
     * @exports IUserCounterAsyncSubscriptions
     * @interface IUserCounterAsyncSubscriptions
     * @property {Array.<IUserSubscriptionState>|null} [subscriptions] UserCounterAsyncSubscriptions subscriptions
     */

    /**
     * Constructs a new UserCounterAsyncSubscriptions.
     * @exports UserCounterAsyncSubscriptions
     * @classdesc Represents a UserCounterAsyncSubscriptions.
     * @implements IUserCounterAsyncSubscriptions
     * @constructor
     * @param {IUserCounterAsyncSubscriptions=} [properties] Properties to set
     */
    function UserCounterAsyncSubscriptions(properties) {
        this.subscriptions = [];
        if (properties)
            for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                if (properties[keys[i]] != null)
                    this[keys[i]] = properties[keys[i]];
    }

    /**
     * UserCounterAsyncSubscriptions subscriptions.
     * @member {Array.<IUserSubscriptionState>} subscriptions
     * @memberof UserCounterAsyncSubscriptions
     * @instance
     */
    UserCounterAsyncSubscriptions.prototype.subscriptions = $util.emptyArray;

    /**
     * Creates a new UserCounterAsyncSubscriptions instance using the specified properties.
     * @function create
     * @memberof UserCounterAsyncSubscriptions
     * @static
     * @param {IUserCounterAsyncSubscriptions=} [properties] Properties to set
     * @returns {UserCounterAsyncSubscriptions} UserCounterAsyncSubscriptions instance
     */
    UserCounterAsyncSubscriptions.create = function create(properties) {
        return new UserCounterAsyncSubscriptions(properties);
    };

    /**
     * Encodes the specified UserCounterAsyncSubscriptions message. Does not implicitly {@link UserCounterAsyncSubscriptions.verify|verify} messages.
     * @function encode
     * @memberof UserCounterAsyncSubscriptions
     * @static
     * @param {IUserCounterAsyncSubscriptions} message UserCounterAsyncSubscriptions message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    UserCounterAsyncSubscriptions.encode = function encode(message, writer) {
        if (!writer)
            writer = $Writer.create();
        if (message.subscriptions != null && message.subscriptions.length)
            for (var i = 0; i < message.subscriptions.length; ++i)
                $root.UserSubscriptionState.encode(message.subscriptions[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
        return writer;
    };

    /**
     * Encodes the specified UserCounterAsyncSubscriptions message, length delimited. Does not implicitly {@link UserCounterAsyncSubscriptions.verify|verify} messages.
     * @function encodeDelimited
     * @memberof UserCounterAsyncSubscriptions
     * @static
     * @param {IUserCounterAsyncSubscriptions} message UserCounterAsyncSubscriptions message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    UserCounterAsyncSubscriptions.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a UserCounterAsyncSubscriptions message from the specified reader or buffer.
     * @function decode
     * @memberof UserCounterAsyncSubscriptions
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {UserCounterAsyncSubscriptions} UserCounterAsyncSubscriptions
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UserCounterAsyncSubscriptions.decode = function decode(reader, length) {
        if (!(reader instanceof $Reader))
            reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length, message = new $root.UserCounterAsyncSubscriptions();
        while (reader.pos < end) {
            var tag = reader.uint32();
            switch (tag >>> 3) {
            case 1:
                if (!(message.subscriptions && message.subscriptions.length))
                    message.subscriptions = [];
                message.subscriptions.push($root.UserSubscriptionState.decode(reader, reader.uint32()));
                break;
            default:
                reader.skipType(tag & 7);
                break;
            }
        }
        return message;
    };

    /**
     * Decodes a UserCounterAsyncSubscriptions message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof UserCounterAsyncSubscriptions
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {UserCounterAsyncSubscriptions} UserCounterAsyncSubscriptions
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UserCounterAsyncSubscriptions.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader))
            reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a UserCounterAsyncSubscriptions message.
     * @function verify
     * @memberof UserCounterAsyncSubscriptions
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    UserCounterAsyncSubscriptions.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
            return "object expected";
        if (message.subscriptions != null && message.hasOwnProperty("subscriptions")) {
            if (!Array.isArray(message.subscriptions))
                return "subscriptions: array expected";
            for (var i = 0; i < message.subscriptions.length; ++i) {
                var error = $root.UserSubscriptionState.verify(message.subscriptions[i]);
                if (error)
                    return "subscriptions." + error;
            }
        }
        return null;
    };

    /**
     * Creates a UserCounterAsyncSubscriptions message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof UserCounterAsyncSubscriptions
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {UserCounterAsyncSubscriptions} UserCounterAsyncSubscriptions
     */
    UserCounterAsyncSubscriptions.fromObject = function fromObject(object) {
        if (object instanceof $root.UserCounterAsyncSubscriptions)
            return object;
        var message = new $root.UserCounterAsyncSubscriptions();
        if (object.subscriptions) {
            if (!Array.isArray(object.subscriptions))
                throw TypeError(".UserCounterAsyncSubscriptions.subscriptions: array expected");
            message.subscriptions = [];
            for (var i = 0; i < object.subscriptions.length; ++i) {
                if (typeof object.subscriptions[i] !== "object")
                    throw TypeError(".UserCounterAsyncSubscriptions.subscriptions: object expected");
                message.subscriptions[i] = $root.UserSubscriptionState.fromObject(object.subscriptions[i]);
            }
        }
        return message;
    };

    /**
     * Creates a plain object from a UserCounterAsyncSubscriptions message. Also converts values to other types if specified.
     * @function toObject
     * @memberof UserCounterAsyncSubscriptions
     * @static
     * @param {UserCounterAsyncSubscriptions} message UserCounterAsyncSubscriptions
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    UserCounterAsyncSubscriptions.toObject = function toObject(message, options) {
        if (!options)
            options = {};
        var object = {};
        if (options.arrays || options.defaults)
            object.subscriptions = [];
        if (message.subscriptions && message.subscriptions.length) {
            object.subscriptions = [];
            for (var j = 0; j < message.subscriptions.length; ++j)
                object.subscriptions[j] = $root.UserSubscriptionState.toObject(message.subscriptions[j], options);
        }
        return object;
    };

    /**
     * Converts this UserCounterAsyncSubscriptions to JSON.
     * @function toJSON
     * @memberof UserCounterAsyncSubscriptions
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    UserCounterAsyncSubscriptions.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return UserCounterAsyncSubscriptions;
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
