import {
    getStore
} from "@netlify/blobs";

import {
    randomBytes,
    timingSafeEqual
} from "node:crypto";



const STORE_NAME =
    "wedding-invitations";

const REGISTRY_KEY =
    "registry";

const RSVP_STORE_NAME =
    "wedding-rsvps";

const RSVP_REGISTRY_KEY =
    "registry";

const SEATING_STORE_NAME =
    "wedding-seating";

const SEATING_REGISTRY_KEY =
    "registry";



function jsonResponse(
    data,
    status = 200
) {

    return Response.json(
        data,
        {
            status,

            headers: {
                "Cache-Control":
                    "no-store"
            }
        }
    );

}



function normalizeName(
    value
) {

    return String(
        value || ""
    )
        .replace(
            /\s+/g,
            " "
        )
        .trim();

}



function nameKey(
    value
) {

    return normalizeName(
        value
    )
        .toLocaleLowerCase(
            "en"
        );

}



function isAuthorized(
    request
) {

    const expected =
        process.env
            .INVITE_ADMIN_SECRET;



    if (
        !expected
    ) {

        return {
            ok: false,
            configurationError: true
        };

    }



    const provided =
        request
            .headers
            .get(
                "x-admin-secret"
            ) || "";



    const expectedBuffer =
        Buffer.from(
            expected
        );



    const providedBuffer =
        Buffer.from(
            provided
        );



    if (
        expectedBuffer.length !==
        providedBuffer.length
    ) {

        return {
            ok: false
        };

    }



    return {
        ok:
            timingSafeEqual(
                expectedBuffer,
                providedBuffer
            )
    };

}



function createCode() {

    return randomBytes(
        12
    )
        .toString(
            "base64url"
        );

}



function getStoreInstance() {

    return getStore(
        STORE_NAME
    );

}



async function getRegistry(
    store
) {

    const registry =
        await store.get(
            REGISTRY_KEY,
            {
                type:
                    "json",

                consistency:
                    "strong"
            }
        );



    if (
        !registry ||
        typeof registry !==
            "object" ||
        !registry.invitations
    ) {

        return {
            version: 1,
            invitations: {}
        };

    }



    return registry;

}



function listInvitations(
    registry
) {

    return Object
        .entries(
            registry.invitations
        )
        .map(
            (
                [
                    code,
                    invitation
                ]
            ) => (
                {
                    code,

                    name:
                        invitation.name,

                    createdAt:
                        invitation
                            .createdAt ||
                        null
                }
            )
        )
        .filter(
            invitation =>
                invitation.name
        )
        .sort(
            (
                a,
                b
            ) =>
                a.name
                    .localeCompare(
                        b.name
                    )
        );

}



export default async function (
    request
) {

    const authorization =
        isAuthorized(
            request
        );



    if (
        authorization
            .configurationError
    ) {

        return jsonResponse(
            {
                error:
                    "INVITE_ADMIN_SECRET is not configured in Netlify."
            },
            500
        );

    }



    if (
        !authorization.ok
    ) {

        return jsonResponse(
            {
                error:
                    "Unauthorized."
            },
            401
        );

    }



    const store =
        getStoreInstance();



    if (
        request.method ===
        "GET"
    ) {

        const registry =
            await getRegistry(
                store
            );



        return jsonResponse(
            {
                invitations:
                    listInvitations(
                        registry
                    )
            }
        );

    }



    if (
        request.method ===
        "POST"
    ) {

        let body;



        try {

            body =
                await request.json();

        } catch {

            return jsonResponse(
                {
                    error:
                        "Invalid JSON request."
                },
                400
            );

        }



        /* =========================================================
           RESTORE AN EXISTING INVITATION CODE
           Used only when you need to recreate a deleted invitation
           while keeping the exact link that was already sent.
        ========================================================= */

        if (
            body.restoreCode &&
            body.restoreName
        ) {

            const restoreCode =
                String(
                    body.restoreCode
                )
                    .trim();

            const restoreName =
                normalizeName(
                    body.restoreName
                );



            if (
                !restoreCode ||
                !restoreName
            ) {

                return jsonResponse(
                    {
                        error:
                            "Restore code and guest name are required."
                    },
                    400
                );

            }



            const registry =
                await getRegistry(
                    store
                );



            if (
                registry
                    .invitations[
                        restoreCode
                    ]
            ) {

                return jsonResponse(
                    {
                        error:
                            "That invitation code already exists."
                    },
                    409
                );

            }



            registry
                .invitations[
                    restoreCode
                ] = {

                    name:
                        restoreName,

                    createdAt:
                        new Date()
                            .toISOString()

                };



            await store.setJSON(
                REGISTRY_KEY,
                registry
            );



            return jsonResponse(
                {
                    restored:
                        true,

                    code:
                        restoreCode,

                    name:
                        restoreName,

                    invitations:
                        listInvitations(
                            registry
                        )
                }
            );

        }



        /* =========================================================
           EDIT AN EXISTING INVITATION
           Keeps the same invitation code/link and createdAt date.
           Also updates the stored RSVP guest name, if one exists.
        ========================================================= */

        if (
            body.editCode &&
            body.editName
        ) {

            const editCode =
                String(
                    body.editCode
                )
                    .trim();

            const editName =
                normalizeName(
                    body.editName
                );


            if (
                !editCode ||
                !editName
            ) {

                return jsonResponse(
                    {
                        error:
                            "Invitation code and guest name are required."
                    },
                    400
                );

            }


            const registry =
                await getRegistry(
                    store
                );

            const existingInvitation =
                registry
                    .invitations[
                        editCode
                    ];


            if (
                !existingInvitation
            ) {

                return jsonResponse(
                    {
                        error:
                            "Invitation not found."
                    },
                    404
                );

            }


            const duplicate =
                Object
                    .entries(
                        registry
                            .invitations
                    )
                    .some(
                        (
                            [
                                code,
                                invitation
                            ]
                        ) =>
                            code !== editCode &&
                            invitation &&
                            invitation.name &&
                            nameKey(
                                invitation.name
                            ) ===
                            nameKey(
                                editName
                            )
                    );


            if (
                duplicate
            ) {

                return jsonResponse(
                    {
                        error:
                            "An invitation already exists for that guest name."
                    },
                    409
                );

            }


            registry
                .invitations[
                    editCode
                ] = {

                    ...existingInvitation,

                    name:
                        editName,

                    createdAt:
                        existingInvitation
                            .createdAt ||
                        new Date()
                            .toISOString()

                };


            const rsvpStore =
                getStore(
                    RSVP_STORE_NAME
                );

            const rsvpRegistryRaw =
                await rsvpStore.get(
                    RSVP_REGISTRY_KEY,
                    {
                        type:
                            "json",

                        consistency:
                            "strong"
                    }
                );

            const rsvpRegistry =
                rsvpRegistryRaw &&
                typeof rsvpRegistryRaw ===
                    "object" &&
                rsvpRegistryRaw.rsvps &&
                typeof rsvpRegistryRaw.rsvps ===
                    "object"
                    ? rsvpRegistryRaw
                    : {
                        version: 1,
                        rsvps: {}
                    };


            if (
                rsvpRegistry
                    .rsvps[
                        editCode
                    ]
            ) {

                rsvpRegistry
                    .rsvps[
                        editCode
                    ] = {

                        ...rsvpRegistry
                            .rsvps[
                                editCode
                            ],

                        guestName:
                            editName,

                        updatedAt:
                            new Date()
                                .toISOString()

                    };

            }


            await Promise.all(
                [
                    store.setJSON(
                        REGISTRY_KEY,
                        registry
                    ),

                    rsvpStore.setJSON(
                        RSVP_REGISTRY_KEY,
                        rsvpRegistry
                    )
                ]
            );


            return jsonResponse(
                {
                    edited:
                        true,

                    code:
                        editCode,

                    name:
                        editName,

                    invitations:
                        listInvitations(
                            registry
                        )
                }
            );

        }


        const rawNames =
            Array.isArray(
                body.names
            )
                ? body.names
                : [];



        const uniqueNames =
            [];

        const inputSeen =
            new Set();



        for (
            const rawName
            of rawNames
        ) {

            const name =
                normalizeName(
                    rawName
                );



            if (
                !name
            ) {

                continue;

            }



            const key =
                nameKey(
                    name
                );



            if (
                inputSeen.has(
                    key
                )
            ) {

                continue;

            }



            inputSeen.add(
                key
            );

            uniqueNames.push(
                name
            );

        }



        if (
            uniqueNames.length ===
            0
        ) {

            return jsonResponse(
                {
                    error:
                        "Add at least one guest name."
                },
                400
            );

        }



        if (
            uniqueNames.length >
            500
        ) {

            return jsonResponse(
                {
                    error:
                        "Generate no more than 500 invitations at a time."
                },
                400
            );

        }



        const registry =
            await getRegistry(
                store
            );



        const existingByName =
            new Map();



        for (
            const [
                code,
                invitation
            ]
            of Object.entries(
                registry
                    .invitations
            )
        ) {

            if (
                invitation &&
                invitation.name
            ) {

                existingByName
                    .set(
                        nameKey(
                            invitation
                                .name
                        ),
                        code
                    );

            }

        }



        let createdCount =
            0;

        let existingCount =
            0;



        for (
            const name
            of uniqueNames
        ) {

            const normalized =
                nameKey(
                    name
                );



            const existingCode =
                existingByName
                    .get(
                        normalized
                    );



            if (
                existingCode
            ) {

                existingCount++;

                continue;

            }



            let code;



            do {

                code =
                    createCode();

            } while (
                registry
                    .invitations[
                        code
                    ]
            );



            registry
                .invitations[
                    code
                ] = {

                    name,

                    createdAt:
                        new Date()
                            .toISOString()

                };



            existingByName
                .set(
                    normalized,
                    code
                );



            createdCount++;

        }



        await store.setJSON(
            REGISTRY_KEY,
            registry
        );



        return jsonResponse(
            {
                createdCount,
                existingCount,

                invitations:
                    listInvitations(
                        registry
                    )
            }
        );

    }



    if (
        request.method ===
        "DELETE"
    ) {

        let body;



        try {

            body =
                await request.json();

        } catch {

            return jsonResponse(
                {
                    error:
                        "Invalid JSON request."
                },
                400
            );

        }



        const code =
            String(
                body.code ||
                ""
            )
                .trim();



        if (
            !code
        ) {

            return jsonResponse(
                {
                    error:
                        "Invitation code is required."
                },
                400
            );

        }



        const registry =
            await getRegistry(
                store
            );



        if (
            !registry
                .invitations[
                    code
                ]
        ) {

            return jsonResponse(
                {
                    error:
                        "Invitation not found."
                },
                404
            );

        }



        delete registry
            .invitations[
                code
            ];


        const rsvpStore =
            getStore(
                RSVP_STORE_NAME
            );

        const seatingStore =
            getStore(
                SEATING_STORE_NAME
            );


        const [
            rsvpRegistryRaw,
            seatingRegistryRaw
        ] =
            await Promise.all(
                [
                    rsvpStore.get(
                        RSVP_REGISTRY_KEY,
                        {
                            type:
                                "json",

                            consistency:
                                "strong"
                        }
                    ),

                    seatingStore.get(
                        SEATING_REGISTRY_KEY,
                        {
                            type:
                                "json",

                            consistency:
                                "strong"
                        }
                    )
                ]
            );


        const rsvpRegistry =
            rsvpRegistryRaw &&
            typeof rsvpRegistryRaw ===
                "object" &&
            rsvpRegistryRaw.rsvps &&
            typeof rsvpRegistryRaw.rsvps ===
                "object"
                ? rsvpRegistryRaw
                : {
                    version: 1,
                    rsvps: {}
                };


        const seatingRegistry =
            seatingRegistryRaw &&
            typeof seatingRegistryRaw ===
                "object"
                ? {
                    ...seatingRegistryRaw,

                    tables:
                        seatingRegistryRaw.tables &&
                        typeof seatingRegistryRaw.tables ===
                            "object"
                            ? seatingRegistryRaw.tables
                            : {},

                    assignments:
                        seatingRegistryRaw.assignments &&
                        typeof seatingRegistryRaw.assignments ===
                            "object"
                            ? seatingRegistryRaw.assignments
                            : {}
                }
                : {
                    version: 1,
                    published: false,
                    updatedAt: null,
                    tables: {},
                    assignments: {}
                };


        delete rsvpRegistry
            .rsvps[
                code
            ];


        const hadAssignment =
            Boolean(
                seatingRegistry
                    .assignments[
                        code
                    ]
            );


        delete seatingRegistry
            .assignments[
                code
            ];


        if (
            hadAssignment
        ) {

            seatingRegistry.updatedAt =
                new Date()
                    .toISOString();

        }


        await Promise.all(
            [
                store.setJSON(
                    REGISTRY_KEY,
                    registry
                ),

                rsvpStore.setJSON(
                    RSVP_REGISTRY_KEY,
                    rsvpRegistry
                ),

                seatingStore.setJSON(
                    SEATING_REGISTRY_KEY,
                    seatingRegistry
                )
            ]
        );



        return jsonResponse(
            {
                deleted: true,

                invitations:
                    listInvitations(
                        registry
                    )
            }
        );

    }



    return jsonResponse(
        {
            error:
                "Method not allowed."
        },
        405
    );

}