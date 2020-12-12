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

/** Properties of a DirectCounterRefs. */
export interface IDirectCounterRefs {

    /** DirectCounterRefs refs */
    refs?: (IDirectCounterRef[]|null);
}

/** Represents a DirectCounterRefs. */
export class DirectCounterRefs implements IDirectCounterRefs {

    /**
     * Constructs a new DirectCounterRefs.
     * @param [properties] Properties to set
     */
    constructor(properties?: IDirectCounterRefs);

    /** DirectCounterRefs refs. */
    public refs: IDirectCounterRef[];

    /**
     * Creates a new DirectCounterRefs instance using the specified properties.
     * @param [properties] Properties to set
     * @returns DirectCounterRefs instance
     */
    public static create(properties?: IDirectCounterRefs): DirectCounterRefs;

    /**
     * Encodes the specified DirectCounterRefs message. Does not implicitly {@link DirectCounterRefs.verify|verify} messages.
     * @param message DirectCounterRefs message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IDirectCounterRefs, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified DirectCounterRefs message, length delimited. Does not implicitly {@link DirectCounterRefs.verify|verify} messages.
     * @param message DirectCounterRefs message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IDirectCounterRefs, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a DirectCounterRefs message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns DirectCounterRefs
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): DirectCounterRefs;

    /**
     * Decodes a DirectCounterRefs message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns DirectCounterRefs
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): DirectCounterRefs;

    /**
     * Verifies a DirectCounterRefs message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a DirectCounterRefs message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns DirectCounterRefs
     */
    public static fromObject(object: { [k: string]: any }): DirectCounterRefs;

    /**
     * Creates a plain object from a DirectCounterRefs message. Also converts values to other types if specified.
     * @param message DirectCounterRefs
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: DirectCounterRefs, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this DirectCounterRefs to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of a DirectCounterRef. */
export interface IDirectCounterRef {

    /** DirectCounterRef uid */
    uid: number;

    /** DirectCounterRef seq */
    seq: number;

    /** DirectCounterRef counter */
    counter: number;

    /** DirectCounterRef mentions */
    mentions: number;
}

/** Represents a DirectCounterRef. */
export class DirectCounterRef implements IDirectCounterRef {

    /**
     * Constructs a new DirectCounterRef.
     * @param [properties] Properties to set
     */
    constructor(properties?: IDirectCounterRef);

    /** DirectCounterRef uid. */
    public uid: number;

    /** DirectCounterRef seq. */
    public seq: number;

    /** DirectCounterRef counter. */
    public counter: number;

    /** DirectCounterRef mentions. */
    public mentions: number;

    /**
     * Creates a new DirectCounterRef instance using the specified properties.
     * @param [properties] Properties to set
     * @returns DirectCounterRef instance
     */
    public static create(properties?: IDirectCounterRef): DirectCounterRef;

    /**
     * Encodes the specified DirectCounterRef message. Does not implicitly {@link DirectCounterRef.verify|verify} messages.
     * @param message DirectCounterRef message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IDirectCounterRef, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified DirectCounterRef message, length delimited. Does not implicitly {@link DirectCounterRef.verify|verify} messages.
     * @param message DirectCounterRef message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IDirectCounterRef, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a DirectCounterRef message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns DirectCounterRef
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): DirectCounterRef;

    /**
     * Decodes a DirectCounterRef message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns DirectCounterRef
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): DirectCounterRef;

    /**
     * Verifies a DirectCounterRef message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a DirectCounterRef message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns DirectCounterRef
     */
    public static fromObject(object: { [k: string]: any }): DirectCounterRef;

    /**
     * Creates a plain object from a DirectCounterRef message. Also converts values to other types if specified.
     * @param message DirectCounterRef
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: DirectCounterRef, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this DirectCounterRef to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of a ConversationCountersState. */
export interface IConversationCountersState {

    /** ConversationCountersState direct */
    direct?: (number[]|null);
}

/** Represents a ConversationCountersState. */
export class ConversationCountersState implements IConversationCountersState {

    /**
     * Constructs a new ConversationCountersState.
     * @param [properties] Properties to set
     */
    constructor(properties?: IConversationCountersState);

    /** ConversationCountersState direct. */
    public direct: number[];

    /**
     * Creates a new ConversationCountersState instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ConversationCountersState instance
     */
    public static create(properties?: IConversationCountersState): ConversationCountersState;

    /**
     * Encodes the specified ConversationCountersState message. Does not implicitly {@link ConversationCountersState.verify|verify} messages.
     * @param message ConversationCountersState message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IConversationCountersState, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified ConversationCountersState message, length delimited. Does not implicitly {@link ConversationCountersState.verify|verify} messages.
     * @param message ConversationCountersState message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IConversationCountersState, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a ConversationCountersState message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ConversationCountersState
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): ConversationCountersState;

    /**
     * Decodes a ConversationCountersState message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ConversationCountersState
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): ConversationCountersState;

    /**
     * Verifies a ConversationCountersState message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a ConversationCountersState message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ConversationCountersState
     */
    public static fromObject(object: { [k: string]: any }): ConversationCountersState;

    /**
     * Creates a plain object from a ConversationCountersState message. Also converts values to other types if specified.
     * @param message ConversationCountersState
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: ConversationCountersState, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this ConversationCountersState to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of a UserCounterState. */
export interface IUserCounterState {

    /** UserCounterState seq */
    seq: number;

    /** UserCounterState muted */
    muted: boolean;

    /** UserCounterState async */
    async: boolean;

    /** UserCounterState counter */
    counter?: (number|null);

    /** UserCounterState mentions */
    mentions?: (number|null);
}

/** Represents a UserCounterState. */
export class UserCounterState implements IUserCounterState {

    /**
     * Constructs a new UserCounterState.
     * @param [properties] Properties to set
     */
    constructor(properties?: IUserCounterState);

    /** UserCounterState seq. */
    public seq: number;

    /** UserCounterState muted. */
    public muted: boolean;

    /** UserCounterState async. */
    public async: boolean;

    /** UserCounterState counter. */
    public counter: number;

    /** UserCounterState mentions. */
    public mentions: number;

    /**
     * Creates a new UserCounterState instance using the specified properties.
     * @param [properties] Properties to set
     * @returns UserCounterState instance
     */
    public static create(properties?: IUserCounterState): UserCounterState;

    /**
     * Encodes the specified UserCounterState message. Does not implicitly {@link UserCounterState.verify|verify} messages.
     * @param message UserCounterState message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IUserCounterState, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified UserCounterState message, length delimited. Does not implicitly {@link UserCounterState.verify|verify} messages.
     * @param message UserCounterState message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IUserCounterState, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a UserCounterState message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns UserCounterState
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): UserCounterState;

    /**
     * Decodes a UserCounterState message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns UserCounterState
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): UserCounterState;

    /**
     * Verifies a UserCounterState message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a UserCounterState message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns UserCounterState
     */
    public static fromObject(object: { [k: string]: any }): UserCounterState;

    /**
     * Creates a plain object from a UserCounterState message. Also converts values to other types if specified.
     * @param message UserCounterState
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: UserCounterState, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this UserCounterState to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of a UserSubscriptionState. */
export interface IUserSubscriptionState {

    /** UserSubscriptionState cid */
    cid: number;

    /** UserSubscriptionState muted */
    muted: boolean;

    /** UserSubscriptionState seq */
    seq: number;
}

/** Represents a UserSubscriptionState. */
export class UserSubscriptionState implements IUserSubscriptionState {

    /**
     * Constructs a new UserSubscriptionState.
     * @param [properties] Properties to set
     */
    constructor(properties?: IUserSubscriptionState);

    /** UserSubscriptionState cid. */
    public cid: number;

    /** UserSubscriptionState muted. */
    public muted: boolean;

    /** UserSubscriptionState seq. */
    public seq: number;

    /**
     * Creates a new UserSubscriptionState instance using the specified properties.
     * @param [properties] Properties to set
     * @returns UserSubscriptionState instance
     */
    public static create(properties?: IUserSubscriptionState): UserSubscriptionState;

    /**
     * Encodes the specified UserSubscriptionState message. Does not implicitly {@link UserSubscriptionState.verify|verify} messages.
     * @param message UserSubscriptionState message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IUserSubscriptionState, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified UserSubscriptionState message, length delimited. Does not implicitly {@link UserSubscriptionState.verify|verify} messages.
     * @param message UserSubscriptionState message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IUserSubscriptionState, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a UserSubscriptionState message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns UserSubscriptionState
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): UserSubscriptionState;

    /**
     * Decodes a UserSubscriptionState message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns UserSubscriptionState
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): UserSubscriptionState;

    /**
     * Verifies a UserSubscriptionState message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a UserSubscriptionState message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns UserSubscriptionState
     */
    public static fromObject(object: { [k: string]: any }): UserSubscriptionState;

    /**
     * Creates a plain object from a UserSubscriptionState message. Also converts values to other types if specified.
     * @param message UserSubscriptionState
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: UserSubscriptionState, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this UserSubscriptionState to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** Properties of a UserCounterAsyncSubscriptions. */
export interface IUserCounterAsyncSubscriptions {

    /** UserCounterAsyncSubscriptions subscriptions */
    subscriptions?: (IUserSubscriptionState[]|null);
}

/** Represents a UserCounterAsyncSubscriptions. */
export class UserCounterAsyncSubscriptions implements IUserCounterAsyncSubscriptions {

    /**
     * Constructs a new UserCounterAsyncSubscriptions.
     * @param [properties] Properties to set
     */
    constructor(properties?: IUserCounterAsyncSubscriptions);

    /** UserCounterAsyncSubscriptions subscriptions. */
    public subscriptions: IUserSubscriptionState[];

    /**
     * Creates a new UserCounterAsyncSubscriptions instance using the specified properties.
     * @param [properties] Properties to set
     * @returns UserCounterAsyncSubscriptions instance
     */
    public static create(properties?: IUserCounterAsyncSubscriptions): UserCounterAsyncSubscriptions;

    /**
     * Encodes the specified UserCounterAsyncSubscriptions message. Does not implicitly {@link UserCounterAsyncSubscriptions.verify|verify} messages.
     * @param message UserCounterAsyncSubscriptions message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(message: IUserCounterAsyncSubscriptions, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Encodes the specified UserCounterAsyncSubscriptions message, length delimited. Does not implicitly {@link UserCounterAsyncSubscriptions.verify|verify} messages.
     * @param message UserCounterAsyncSubscriptions message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(message: IUserCounterAsyncSubscriptions, writer?: $protobuf.Writer): $protobuf.Writer;

    /**
     * Decodes a UserCounterAsyncSubscriptions message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns UserCounterAsyncSubscriptions
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): UserCounterAsyncSubscriptions;

    /**
     * Decodes a UserCounterAsyncSubscriptions message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns UserCounterAsyncSubscriptions
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): UserCounterAsyncSubscriptions;

    /**
     * Verifies a UserCounterAsyncSubscriptions message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): (string|null);

    /**
     * Creates a UserCounterAsyncSubscriptions message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns UserCounterAsyncSubscriptions
     */
    public static fromObject(object: { [k: string]: any }): UserCounterAsyncSubscriptions;

    /**
     * Creates a plain object from a UserCounterAsyncSubscriptions message. Also converts values to other types if specified.
     * @param message UserCounterAsyncSubscriptions
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(message: UserCounterAsyncSubscriptions, options?: $protobuf.IConversionOptions): { [k: string]: any };

    /**
     * Converts this UserCounterAsyncSubscriptions to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };
}

/** TreeNodeType enum. */
export enum TreeNodeType {
    LEAF = 0,
    INNER = 1
}
