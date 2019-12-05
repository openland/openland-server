import * as $protobuf from "protobufjs";
/** Namespace vostok_api. */
export namespace vostok_api {

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
        constructor(properties?: vostok_api.IGQLRequest);

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
        public static create(properties?: vostok_api.IGQLRequest): vostok_api.GQLRequest;

        /**
         * Encodes the specified GQLRequest message. Does not implicitly {@link vostok_api.GQLRequest.verify|verify} messages.
         * @param message GQLRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: vostok_api.IGQLRequest, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified GQLRequest message, length delimited. Does not implicitly {@link vostok_api.GQLRequest.verify|verify} messages.
         * @param message GQLRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: vostok_api.IGQLRequest, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a GQLRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GQLRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): vostok_api.GQLRequest;

        /**
         * Decodes a GQLRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GQLRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): vostok_api.GQLRequest;

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
        public static fromObject(object: { [k: string]: any }): vostok_api.GQLRequest;

        /**
         * Creates a plain object from a GQLRequest message. Also converts values to other types if specified.
         * @param message GQLRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: vostok_api.GQLRequest, options?: $protobuf.IConversionOptions): { [k: string]: any };

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
        constructor(properties?: vostok_api.IGQLResponse);

        /** GQLResponse id. */
        public id: string;

        /** GQLResponse result. */
        public result: string;

        /**
         * Creates a new GQLResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GQLResponse instance
         */
        public static create(properties?: vostok_api.IGQLResponse): vostok_api.GQLResponse;

        /**
         * Encodes the specified GQLResponse message. Does not implicitly {@link vostok_api.GQLResponse.verify|verify} messages.
         * @param message GQLResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: vostok_api.IGQLResponse, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified GQLResponse message, length delimited. Does not implicitly {@link vostok_api.GQLResponse.verify|verify} messages.
         * @param message GQLResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: vostok_api.IGQLResponse, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a GQLResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GQLResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): vostok_api.GQLResponse;

        /**
         * Decodes a GQLResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GQLResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): vostok_api.GQLResponse;

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
        public static fromObject(object: { [k: string]: any }): vostok_api.GQLResponse;

        /**
         * Creates a plain object from a GQLResponse message. Also converts values to other types if specified.
         * @param message GQLResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: vostok_api.GQLResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

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
        constructor(properties?: vostok_api.IGQLSubscription);

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
        public static create(properties?: vostok_api.IGQLSubscription): vostok_api.GQLSubscription;

        /**
         * Encodes the specified GQLSubscription message. Does not implicitly {@link vostok_api.GQLSubscription.verify|verify} messages.
         * @param message GQLSubscription message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: vostok_api.IGQLSubscription, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified GQLSubscription message, length delimited. Does not implicitly {@link vostok_api.GQLSubscription.verify|verify} messages.
         * @param message GQLSubscription message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: vostok_api.IGQLSubscription, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a GQLSubscription message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GQLSubscription
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): vostok_api.GQLSubscription;

        /**
         * Decodes a GQLSubscription message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GQLSubscription
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): vostok_api.GQLSubscription;

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
        public static fromObject(object: { [k: string]: any }): vostok_api.GQLSubscription;

        /**
         * Creates a plain object from a GQLSubscription message. Also converts values to other types if specified.
         * @param message GQLSubscription
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: vostok_api.GQLSubscription, options?: $protobuf.IConversionOptions): { [k: string]: any };

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
        constructor(properties?: vostok_api.IGQLSubscriptionStop);

        /** GQLSubscriptionStop id. */
        public id: string;

        /**
         * Creates a new GQLSubscriptionStop instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GQLSubscriptionStop instance
         */
        public static create(properties?: vostok_api.IGQLSubscriptionStop): vostok_api.GQLSubscriptionStop;

        /**
         * Encodes the specified GQLSubscriptionStop message. Does not implicitly {@link vostok_api.GQLSubscriptionStop.verify|verify} messages.
         * @param message GQLSubscriptionStop message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: vostok_api.IGQLSubscriptionStop, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified GQLSubscriptionStop message, length delimited. Does not implicitly {@link vostok_api.GQLSubscriptionStop.verify|verify} messages.
         * @param message GQLSubscriptionStop message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: vostok_api.IGQLSubscriptionStop, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a GQLSubscriptionStop message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GQLSubscriptionStop
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): vostok_api.GQLSubscriptionStop;

        /**
         * Decodes a GQLSubscriptionStop message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GQLSubscriptionStop
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): vostok_api.GQLSubscriptionStop;

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
        public static fromObject(object: { [k: string]: any }): vostok_api.GQLSubscriptionStop;

        /**
         * Creates a plain object from a GQLSubscriptionStop message. Also converts values to other types if specified.
         * @param message GQLSubscriptionStop
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: vostok_api.GQLSubscriptionStop, options?: $protobuf.IConversionOptions): { [k: string]: any };

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
        constructor(properties?: vostok_api.IGQLSubscriptionResponse);

        /** GQLSubscriptionResponse id. */
        public id: string;

        /** GQLSubscriptionResponse result. */
        public result: string;

        /**
         * Creates a new GQLSubscriptionResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GQLSubscriptionResponse instance
         */
        public static create(properties?: vostok_api.IGQLSubscriptionResponse): vostok_api.GQLSubscriptionResponse;

        /**
         * Encodes the specified GQLSubscriptionResponse message. Does not implicitly {@link vostok_api.GQLSubscriptionResponse.verify|verify} messages.
         * @param message GQLSubscriptionResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: vostok_api.IGQLSubscriptionResponse, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified GQLSubscriptionResponse message, length delimited. Does not implicitly {@link vostok_api.GQLSubscriptionResponse.verify|verify} messages.
         * @param message GQLSubscriptionResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: vostok_api.IGQLSubscriptionResponse, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a GQLSubscriptionResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GQLSubscriptionResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): vostok_api.GQLSubscriptionResponse;

        /**
         * Decodes a GQLSubscriptionResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GQLSubscriptionResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): vostok_api.GQLSubscriptionResponse;

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
        public static fromObject(object: { [k: string]: any }): vostok_api.GQLSubscriptionResponse;

        /**
         * Creates a plain object from a GQLSubscriptionResponse message. Also converts values to other types if specified.
         * @param message GQLSubscriptionResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: vostok_api.GQLSubscriptionResponse, options?: $protobuf.IConversionOptions): { [k: string]: any };

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
        constructor(properties?: vostok_api.IGQLSubscriptionComplete);

        /** GQLSubscriptionComplete id. */
        public id: string;

        /**
         * Creates a new GQLSubscriptionComplete instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GQLSubscriptionComplete instance
         */
        public static create(properties?: vostok_api.IGQLSubscriptionComplete): vostok_api.GQLSubscriptionComplete;

        /**
         * Encodes the specified GQLSubscriptionComplete message. Does not implicitly {@link vostok_api.GQLSubscriptionComplete.verify|verify} messages.
         * @param message GQLSubscriptionComplete message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: vostok_api.IGQLSubscriptionComplete, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified GQLSubscriptionComplete message, length delimited. Does not implicitly {@link vostok_api.GQLSubscriptionComplete.verify|verify} messages.
         * @param message GQLSubscriptionComplete message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: vostok_api.IGQLSubscriptionComplete, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a GQLSubscriptionComplete message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GQLSubscriptionComplete
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): vostok_api.GQLSubscriptionComplete;

        /**
         * Decodes a GQLSubscriptionComplete message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GQLSubscriptionComplete
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): vostok_api.GQLSubscriptionComplete;

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
        public static fromObject(object: { [k: string]: any }): vostok_api.GQLSubscriptionComplete;

        /**
         * Creates a plain object from a GQLSubscriptionComplete message. Also converts values to other types if specified.
         * @param message GQLSubscriptionComplete
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: vostok_api.GQLSubscriptionComplete, options?: $protobuf.IConversionOptions): { [k: string]: any };

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
