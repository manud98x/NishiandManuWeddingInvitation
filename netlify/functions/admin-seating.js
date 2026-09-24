import {
    getStore
} from "@netlify/blobs";

import {
    randomUUID,
    timingSafeEqual
} from "node:crypto";


const STORE_NAME =
    "wedding-seating";

const REGISTRY_KEY =
    "registry";

const INVITATION_STORE_NAME =
    "wedding-invitations";

const INVITATION_REGISTRY_KEY =
    "registry";

const RSVP_STORE_NAME =
    "wedding-rsvps";

const RSVP_REGISTRY_KEY =
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


function cleanText(
    value,
    maxLength = 100
) {

    return String(
        value || ""
    )
        .replace(
            /\s+/g,
            " "
        )
        .trim()
        .slice(
            0,
            maxLength
        );

}


function cleanShape(
    value
) {

    const allowed =
        new Set(
            [
                "round",
                "square",
                "rectangle",
                "banquet"
            ]
        );


    return allowed.has(
        value
    )
        ? value
        : "round";

}


function cleanCapacity(
    value
) {

    const number =
        Number(
            value
        );


    if (
        !Number.isInteger(
            number
        ) ||
        number < 1 ||
        number > 100
    ) {

        return null;

    }


    return number;

}


function cleanNumber(
    value,
    fallback = 0
) {

    const number =
        Number(
            value
        );


    return Number.isFinite(
        number
    )
        ? number
        : fallback;

}


function numericGuestCount(
    value
) {

    if (
        value === "5+"
    ) {

        return 5;

    }


    const number =
        Number(
            value
        );


    return Number.isFinite(
        number
    )
        ? Math.max(
            0,
            number
        )
        : 0;

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
        !registry.tables ||
        typeof registry.tables !==
            "object"
    ) {

        return {
            version: 1,
            published: false,
            updatedAt: null,
            tables: {},
            assignments: {}
        };

    }


    if (
        !registry.assignments ||
        typeof registry.assignments !==
            "object"
    ) {

        registry.assignments =
            {};

    }


    if (
        typeof registry.published !==
            "boolean"
    ) {

        registry.published =
            false;

    }


    if (
        typeof registry.updatedAt !==
            "string"
    ) {

        registry.updatedAt =
            null;

    }


    return registry;

}


async function getInvitationRegistry() {

    const store =
        getStore(
            INVITATION_STORE_NAME
        );

    const registry =
        await store.get(
            INVITATION_REGISTRY_KEY,
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
        !registry.invitations ||
        typeof registry.invitations !==
            "object"
    ) {

        return {
            version: 1,
            invitations: {}
        };

    }


    return registry;

}


async function getRsvpRegistry() {

    const store =
        getStore(
            RSVP_STORE_NAME
        );

    const registry =
        await store.get(
            RSVP_REGISTRY_KEY,
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
        !registry.rsvps ||
        typeof registry.rsvps !==
            "object"
    ) {

        return {
            version: 1,
            rsvps: {}
        };

    }


    return registry;

}


function attendingGuestMap(
    rsvpRegistry,
    invitationRegistry
) {

    const map =
        {};


    for (
        const [
            invitationCode,
            rsvp
        ]
        of Object.entries(
            rsvpRegistry.rsvps
        )
    ) {

        if (
            !rsvp ||
            rsvp.attendance !==
                "Yes" ||
            !invitationRegistry
                .invitations[
                    invitationCode
                ]
        ) {

            continue;

        }


        map[
            invitationCode
        ] = {

            invitationCode,

            guestName:
                rsvp.guestName ||
                invitationCode,

            guestCount:
                numericGuestCount(
                    rsvp.guests
                ),

            guests:
                rsvp.guests,

            message:
                rsvp.message ||
                ""
        };

    }


    return map;

}


function pruneStaleAssignments(
    registry,
    attendingGuests
) {

    let changed =
        false;


    for (
        const invitationCode
        of Object.keys(
            registry.assignments
        )
    ) {

        if (
            attendingGuests[
                invitationCode
            ]
        ) {

            continue;

        }


        delete registry
            .assignments[
                invitationCode
            ];

        changed =
            true;

    }


    if (
        changed
    ) {

        registry.updatedAt =
            new Date()
                .toISOString();

    }


    return changed;

}


function tableOccupancy(
    tableId,
    registry,
    attendingGuests
) {

    let people =
        0;

    let invitationCount =
        0;


    for (
        const [
            invitationCode,
            assignment
        ]
        of Object.entries(
            registry.assignments
        )
    ) {

        if (
            !assignment ||
            assignment.tableId !==
                tableId
        ) {

            continue;

        }


        const guest =
            attendingGuests[
                invitationCode
            ];


        if (
            !guest
        ) {

            continue;

        }


        invitationCount +=
            1;

        people +=
            guest.guestCount;

    }


    return {
        people,
        invitationCount
    };

}


function listTables(
    registry,
    attendingGuests
) {

    return Object
        .values(
            registry.tables
        )
        .map(
            table => {

                const assignedCodes =
                    Object.entries(
                        registry.assignments
                    )
                        .filter(
                            (
                                [
                                    ,
                                    assignment
                                ]
                            ) =>
                                assignment &&
                                assignment.tableId ===
                                    table.id
                        )
                        .map(
                            (
                                [
                                    code
                                ]
                            ) =>
                                code
                        );


                const occupancy =
                    tableOccupancy(
                        table.id,
                        registry,
                        attendingGuests
                    );


                return {
                    ...table,

                    assignedCodes,

                    assignedPeople:
                        occupancy.people,

                    assignedInvitations:
                        occupancy.invitationCount,

                    remainingCapacity:
                        Math.max(
                            0,
                            Number(
                                table.capacity ||
                                0
                            ) -
                            occupancy.people
                        )
                };

            }
        )
        .sort(
            (
                a,
                b
            ) =>
                a.name
                    .localeCompare(
                        b.name,
                        undefined,
                        {
                            numeric: true
                        }
                    )
        );

}


function buildResponse(
    registry,
    rsvpRegistry,
    invitationRegistry
) {

    const attendingGuests =
        attendingGuestMap(
            rsvpRegistry,
            invitationRegistry
        );


    const guests =
        Object
            .values(
                attendingGuests
            )
            .map(
                guest => {

                    const assignment =
                        registry.assignments[
                            guest.invitationCode
                        ] || null;


                    return {
                        ...guest,

                        tableId:
                            assignment
                                ? assignment.tableId
                                : null
                    };

                }
            )
            .sort(
                (
                    a,
                    b
                ) =>
                    a.guestName
                        .localeCompare(
                            b.guestName
                        )
            );


    return {
        published:
            registry.published,

        updatedAt:
            registry.updatedAt ||
            null,

        tables:
            listTables(
                registry,
                attendingGuests
            ),

        assignments:
            registry.assignments,

        attendingGuests:
            guests
    };

}


function markRegistryUpdated(
    registry
) {

    registry.updatedAt =
        new Date()
            .toISOString();

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

        const [
            registry,
            rsvpRegistry,
            invitationRegistry
        ] =
            await Promise.all(
                [
                    getRegistry(
                        store
                    ),
                    getRsvpRegistry(),
                    getInvitationRegistry()
                ]
            );


        const attendingGuests =
            attendingGuestMap(
                rsvpRegistry,
                invitationRegistry
            );


        if (
            pruneStaleAssignments(
                registry,
                attendingGuests
            )
        ) {

            await store.setJSON(
                REGISTRY_KEY,
                registry
            );

        }


        return jsonResponse(
            buildResponse(
                registry,
                rsvpRegistry,
                invitationRegistry
            )
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


        const [
            registry,
            rsvpRegistry,
            invitationRegistry
        ] =
            await Promise.all(
                [
                    getRegistry(
                        store
                    ),
                    getRsvpRegistry(),
                    getInvitationRegistry()
                ]
            );


        const attendingGuests =
            attendingGuestMap(
                rsvpRegistry,
                invitationRegistry
            );


        if (
            pruneStaleAssignments(
                registry,
                attendingGuests
            )
        ) {

            await store.setJSON(
                REGISTRY_KEY,
                registry
            );

        }


        if (
            body.action ===
            "createTable"
        ) {

            const name =
                cleanText(
                    body.name,
                    80
                );

            const shape =
                cleanShape(
                    body.shape
                );

            const capacity =
                cleanCapacity(
                    body.capacity
                );


            if (
                !name
            ) {

                return jsonResponse(
                    {
                        error:
                            "Table name is required."
                    },
                    400
                );

            }


            if (
                capacity ===
                null
            ) {

                return jsonResponse(
                    {
                        error:
                            "Capacity must be a whole number between 1 and 100."
                    },
                    400
                );

            }


            const duplicate =
                Object
                    .values(
                        registry.tables
                    )
                    .some(
                        table =>
                            table.name
                                .toLocaleLowerCase() ===
                            name
                                .toLocaleLowerCase()
                    );


            if (
                duplicate
            ) {

                return jsonResponse(
                    {
                        error:
                            "A table with that name already exists."
                    },
                    409
                );

            }


            const id =
                `table-${randomUUID()}`;


            registry.tables[
                id
            ] = {

                id,
                name,
                shape,
                capacity,

                x:
                    50,

                y:
                    50,

                rotation:
                    0,

                width:
                    shape === "banquet"
                        ? 18
                        : (
                            shape === "rectangle"
                                ? 13
                                : 10
                        ),

                height:
                    shape === "banquet"
                        ? 7
                        : (
                            shape === "rectangle"
                                ? 9
                                : 10
                        ),

                createdAt:
                    new Date()
                        .toISOString(),

                updatedAt:
                    new Date()
                        .toISOString()
            };


            markRegistryUpdated(
                registry
            );

            await store.setJSON(
                REGISTRY_KEY,
                registry
            );


            return jsonResponse(
                {
                    created: true,
                    ...buildResponse(
                        registry,
                        rsvpRegistry,
                        invitationRegistry
                    )
                }
            );

        }


        if (
            body.action ===
            "updateTable"
        ) {

            const id =
                cleanText(
                    body.id,
                    120
                );

            const existing =
                registry.tables[
                    id
                ];


            if (
                !existing
            ) {

                return jsonResponse(
                    {
                        error:
                            "Table not found."
                    },
                    404
                );

            }


            const name =
                cleanText(
                    body.name,
                    80
                );

            const shape =
                cleanShape(
                    body.shape
                );

            const capacity =
                cleanCapacity(
                    body.capacity
                );


            if (
                !name
            ) {

                return jsonResponse(
                    {
                        error:
                            "Table name is required."
                    },
                    400
                );

            }


            if (
                capacity ===
                null
            ) {

                return jsonResponse(
                    {
                        error:
                            "Capacity must be a whole number between 1 and 100."
                    },
                    400
                );

            }


            const occupancy =
                tableOccupancy(
                    id,
                    registry,
                    attendingGuests
                );


            if (
                capacity <
                occupancy.people
            ) {

                return jsonResponse(
                    {
                        error:
                            `This table already has ${occupancy.people} people assigned. Capacity cannot be reduced below that number.`
                    },
                    409
                );

            }


            const duplicate =
                Object
                    .values(
                        registry.tables
                    )
                    .some(
                        table =>
                            table.id !== id &&
                            table.name
                                .toLocaleLowerCase() ===
                            name
                                .toLocaleLowerCase()
                    );


            if (
                duplicate
            ) {

                return jsonResponse(
                    {
                        error:
                            "A table with that name already exists."
                    },
                    409
                );

            }


            registry.tables[
                id
            ] = {

                ...existing,

                name,
                shape,
                capacity,

                x:
                    cleanNumber(
                        body.x,
                        existing.x
                    ),

                y:
                    cleanNumber(
                        body.y,
                        existing.y
                    ),

                rotation:
                    cleanNumber(
                        body.rotation,
                        existing.rotation
                    ),

                width:
                    cleanNumber(
                        body.width,
                        existing.width
                    ),

                height:
                    cleanNumber(
                        body.height,
                        existing.height
                    ),

                updatedAt:
                    new Date()
                        .toISOString()
            };


            markRegistryUpdated(
                registry
            );

            await store.setJSON(
                REGISTRY_KEY,
                registry
            );


            return jsonResponse(
                {
                    updated: true,
                    ...buildResponse(
                        registry,
                        rsvpRegistry,
                        invitationRegistry
                    )
                }
            );

        }


        if (
            body.action ===
            "assignGuest"
        ) {

            const invitationCode =
                cleanText(
                    body.invitationCode,
                    160
                );

            const tableId =
                cleanText(
                    body.tableId,
                    160
                );


            const guest =
                attendingGuests[
                    invitationCode
                ];

            const table =
                registry.tables[
                    tableId
                ];


            if (
                !guest
            ) {

                return jsonResponse(
                    {
                        error:
                            "Only guests who RSVP'd Attending can be assigned to a table."
                    },
                    400
                );

            }


            if (
                !table
            ) {

                return jsonResponse(
                    {
                        error:
                            "Table not found."
                    },
                    404
                );

            }


            const currentAssignment =
                registry.assignments[
                    invitationCode
                ];


            if (
                currentAssignment &&
                currentAssignment.tableId ===
                    tableId
            ) {

                return jsonResponse(
                    {
                        error:
                            "That guest is already assigned to this table."
                    },
                    409
                );

            }


            const occupancy =
                tableOccupancy(
                    tableId,
                    registry,
                    attendingGuests
                );


            const projectedPeople =
                occupancy.people +
                guest.guestCount;


            if (
                projectedPeople >
                Number(
                    table.capacity
                )
            ) {

                return jsonResponse(
                    {
                        error:
                            `${guest.guestName} has ${guest.guestCount} attending. ${table.name} only has ${Math.max(0, Number(table.capacity) - occupancy.people)} seat(s) remaining.`
                    },
                    409
                );

            }


            registry.assignments[
                invitationCode
            ] = {

                tableId,

                assignedAt:
                    new Date()
                        .toISOString()
            };


            markRegistryUpdated(
                registry
            );

            await store.setJSON(
                REGISTRY_KEY,
                registry
            );


            return jsonResponse(
                {
                    assigned: true,
                    ...buildResponse(
                        registry,
                        rsvpRegistry,
                        invitationRegistry
                    )
                }
            );

        }


        if (
            body.action ===
            "unassignGuest"
        ) {

            const invitationCode =
                cleanText(
                    body.invitationCode,
                    160
                );


            if (
                !registry.assignments[
                    invitationCode
                ]
            ) {

                return jsonResponse(
                    {
                        error:
                            "That guest is not currently assigned to a table."
                    },
                    404
                );

            }


            delete registry.assignments[
                invitationCode
            ];


            markRegistryUpdated(
                registry
            );

            await store.setJSON(
                REGISTRY_KEY,
                registry
            );


            return jsonResponse(
                {
                    unassigned: true,
                    ...buildResponse(
                        registry,
                        rsvpRegistry,
                        invitationRegistry
                    )
                }
            );

        }


        if (
            body.action ===
            "setPublished"
        ) {

            registry.published =
                Boolean(
                    body.published
                );


            markRegistryUpdated(
                registry
            );

            await store.setJSON(
                REGISTRY_KEY,
                registry
            );


            return jsonResponse(
                {
                    updated: true,
                    ...buildResponse(
                        registry,
                        rsvpRegistry,
                        invitationRegistry
                    )
                }
            );

        }


        return jsonResponse(
            {
                error:
                    "Unsupported seating action."
            },
            400
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


        const id =
            cleanText(
                body.id,
                120
            );


        const [
            registry,
            rsvpRegistry
        ] =
            await Promise.all(
                [
                    getRegistry(
                        store
                    ),
                    getRsvpRegistry()
                ]
            );


        if (
            !registry.tables[
                id
            ]
        ) {

            return jsonResponse(
                {
                    error:
                        "Table not found."
                },
                404
            );

        }


        delete registry.tables[
            id
        ];


        for (
            const [
                code,
                assignment
            ]
            of Object.entries(
                registry.assignments
            )
        ) {

            if (
                assignment &&
                assignment.tableId ===
                    id
            ) {

                delete registry.assignments[
                    code
                ];

            }

        }


        markRegistryUpdated(
            registry
        );

        await store.setJSON(
            REGISTRY_KEY,
            registry
        );


        return jsonResponse(
            {
                deleted: true,
                ...buildResponse(
                        registry,
                        rsvpRegistry,
                        invitationRegistry
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