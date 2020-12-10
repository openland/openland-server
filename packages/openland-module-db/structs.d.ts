import * as $protobuf from "protobufjs";
/** Properties of a TreeNode. */
export interface ITreeNode {

    /** TreeNode id */
    id: number;

    /** TreeNode parent */
    parent?: (number|null);

    /** TreeNode type */
    type: TreeNodeType;

    /** TreeNode values */
    values?: (number[]|null);

    /** TreeNode children */
    children?: (INodeChildren[]|null);
}

/** Represents a TreeNode. */
export class TreeNode implements ITreeNode {

    /**
     * Constructs a new TreeNode.
     * @param [properties] Properties to set
     */
    constructor(properties?: ITreeNode);

    /** TreeNode id. */
    public id: number;

    /** TreeNode parent. */
    public parent: number;

    /** TreeNode type. */
    public type: TreeNodeType;

    /** TreeNode values. */
    public values: number[];

    /** TreeNode children. */
    public children: INodeChildren[];

    /**
     * Creates a new TreeNode instance using the specified properties.
     * @param [properties] Properties to set
     * @returns TreeNode instance
     */
    public static create(properties?: ITreeNode): TreeNode;

    /**
     * Encodes the specified TreeNode message. Does not implicitly {@link TreeNode.verify|verify} messages.
     * @param message TreeNode message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ITreeNode, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified TreeNode message, length delimited. Does not implicitly {@link TreeNode.verify|verify} messages.
     * @param message TreeNode message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ITreeNode, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a TreeNode message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns TreeNode
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): TreeNode;

    /**
     * Decodes a TreeNode message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns TreeNode
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): TreeNode;

    /**
     * Verifies a TreeNode message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a TreeNode message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns TreeNode
     */
    public static fromObject(object: { [k: string]: any }): TreeNode;

    /**
     * Creates a plain object from a TreeNode message. Also converts values to other types if specified.
     * @param message TreeNode
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: TreeNode, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this TreeNode to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of a NodeChildren. */
export interface INodeChildren {

    /** NodeChildren id */
    id: number;

    /** NodeChildren max */
    max: number;

    /** NodeChildren min */
    min: number;

    /** NodeChildren count */
    count: number;
}

/** Represents a NodeChildren. */
export class NodeChildren implements INodeChildren {

    /**
     * Constructs a new NodeChildren.
     * @param [properties] Properties to set
     */
    constructor(properties?: INodeChildren);

    /** NodeChildren id. */
    public id: number;

    /** NodeChildren max. */
    public max: number;

    /** NodeChildren min. */
    public min: number;

    /** NodeChildren count. */
    public count: number;

    /**
     * Creates a new NodeChildren instance using the specified properties.
     * @param [properties] Properties to set
     * @returns NodeChildren instance
     */
    public static create(properties?: INodeChildren): NodeChildren;

    /**
     * Encodes the specified NodeChildren message. Does not implicitly {@link NodeChildren.verify|verify} messages.
     * @param message NodeChildren message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: INodeChildren, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified NodeChildren message, length delimited. Does not implicitly {@link NodeChildren.verify|verify} messages.
     * @param message NodeChildren message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: INodeChildren, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a NodeChildren message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns NodeChildren
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): NodeChildren;

    /**
     * Decodes a NodeChildren message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns NodeChildren
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): NodeChildren;

    /**
     * Verifies a NodeChildren message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a NodeChildren message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns NodeChildren
     */
    public static fromObject(object: { [k: string]: any }): NodeChildren;

    /**
     * Creates a plain object from a NodeChildren message. Also converts values to other types if specified.
     * @param message NodeChildren
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: NodeChildren, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this NodeChildren to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of a TreeHead. */
export interface ITreeHead {

    /** TreeHead counter */
    counter: number;

    /** TreeHead root */
    root?: (number|null);
}

/** Represents a TreeHead. */
export class TreeHead implements ITreeHead {

    /**
     * Constructs a new TreeHead.
     * @param [properties] Properties to set
     */
    constructor(properties?: ITreeHead);

    /** TreeHead counter. */
    public counter: number;

    /** TreeHead root. */
    public root: number;

    /**
     * Creates a new TreeHead instance using the specified properties.
     * @param [properties] Properties to set
     * @returns TreeHead instance
     */
    public static create(properties?: ITreeHead): TreeHead;

    /**
     * Encodes the specified TreeHead message. Does not implicitly {@link TreeHead.verify|verify} messages.
     * @param message TreeHead message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ITreeHead, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified TreeHead message, length delimited. Does not implicitly {@link TreeHead.verify|verify} messages.
     * @param message TreeHead message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ITreeHead, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a TreeHead message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns TreeHead
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): TreeHead;

    /**
     * Decodes a TreeHead message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns TreeHead
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): TreeHead;

    /**
     * Verifies a TreeHead message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a TreeHead message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns TreeHead
     */
    public static fromObject(object: { [k: string]: any }): TreeHead;

    /**
     * Creates a plain object from a TreeHead message. Also converts values to other types if specified.
     * @param message TreeHead
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: TreeHead, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this TreeHead to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of a CountersMessageRef. */
export interface ICountersMessageRef {

    /** CountersMessageRef sender */
    sender: number;

    /** CountersMessageRef mentions */
    mentions?: (number[]|null);

    /** CountersMessageRef allMention */
    allMention: boolean;

    /** CountersMessageRef visibleOnlyTo */
    visibleOnlyTo?: (number[]|null);
}

/** Represents a CountersMessageRef. */
export class CountersMessageRef implements ICountersMessageRef {

    /**
     * Constructs a new CountersMessageRef.
     * @param [properties] Properties to set
     */
    constructor(properties?: ICountersMessageRef);

    /** CountersMessageRef sender. */
    public sender: number;

    /** CountersMessageRef mentions. */
    public mentions: number[];

    /** CountersMessageRef allMention. */
    public allMention: boolean;

    /** CountersMessageRef visibleOnlyTo. */
    public visibleOnlyTo: number[];

    /**
     * Creates a new CountersMessageRef instance using the specified properties.
     * @param [properties] Properties to set
     * @returns CountersMessageRef instance
     */
    public static create(properties?: ICountersMessageRef): CountersMessageRef;

    /**
     * Encodes the specified CountersMessageRef message. Does not implicitly {@link CountersMessageRef.verify|verify} messages.
     * @param message CountersMessageRef message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: ICountersMessageRef, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified CountersMessageRef message, length delimited. Does not implicitly {@link CountersMessageRef.verify|verify} messages.
     * @param message CountersMessageRef message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: ICountersMessageRef, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a CountersMessageRef message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns CountersMessageRef
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): CountersMessageRef;

    /**
     * Decodes a CountersMessageRef message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns CountersMessageRef
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): CountersMessageRef;

    /**
     * Verifies a CountersMessageRef message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a CountersMessageRef message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns CountersMessageRef
     */
    public static fromObject(object: { [k: string]: any }): CountersMessageRef;

    /**
     * Creates a plain object from a CountersMessageRef message. Also converts values to other types if specified.
     * @param message CountersMessageRef
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: CountersMessageRef, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this CountersMessageRef to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** TreeNodeType enum. */
export enum TreeNodeType {
    LEAF = 0,
    INNER = 1
}
