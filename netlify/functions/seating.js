import {
    getStore
} from "@netlify/blobs";


const INVITATION_STORE_NAME =
    "wedding-invitations";

const INVITATION_REGISTRY_KEY =
    "registry";

const SEATING_STORE_NAME =
    "wedding-seating";

const SEATING_REGISTRY_KEY =
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


function cleanCode(
    value
) {

    return String(
        value || ""
    )
        .trim()
        .slice(
            0,
            160
        );

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


async function getSeatingRegistry() {

    const store =
        getStore(
            SEATING_STORE_NAME
        );

    const registry =
        await store.get(
            SEATING_REGISTRY_KEY,
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
            "object"
    ) {

        return {
            version: 1,
            published: false,
            tables: {},
            assignments: {}
        };

    }


    return {
        version:
            registry.version || 1,

        published:
            Boolean(
                registry.published
            ),

        tables:
            registry.tables &&
            typeof registry.tables ===
                "object"
                ? registry.tables
                : {},

        assignments:
            registry.assignments &&
            typeof registry.assignments ===
                "object"
                ? registry.assignments
                : {}
    };

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


export default async function (
    request
) {

    if (
        request.method !==
        "GET"
    ) {

        return jsonResponse(
            {
                error:
                    "Method not allowed."
            },
            405
        );

    }


    const url =
        new URL(
            request.url
        );

    const invitationCode =
        cleanCode(
            url.searchParams.get(
                "code"
            )
        );


    if (
        !invitationCode
    ) {

        return jsonResponse(
            {
                error:
                    "Invitation code is required."
            },
            400
        );

    }


    const [
        invitationRegistry,
        seatingRegistry,
        rsvpRegistry
    ] =
        await Promise.all(
            [
                getInvitationRegistry(),
                getSeatingRegistry(),
                getRsvpRegistry()
            ]
        );


    if (
        !invitationRegistry
            .invitations[
                invitationCode
            ]
    ) {

        return jsonResponse(
            {
                error:
                    "Invalid invitation link."
            },
            404
        );

    }


    const rsvp =
        rsvpRegistry
            .rsvps[
                invitationCode
            ];


    if (
        !rsvp ||
        rsvp.attendance !==
            "Yes"
    ) {

        return jsonResponse(
            {
                published:
                    Boolean(
                        seatingRegistry.published
                    ),

                assigned:
                    false
            }
        );

    }


    if (
        !seatingRegistry.published
    ) {

        return jsonResponse(
            {
                published: false,
                assigned: false
            }
        );

    }


    const assignment =
        seatingRegistry
            .assignments[
                invitationCode
            ];


    if (
        !assignment ||
        !assignment.tableId
    ) {

        return jsonResponse(
            {
                published: true,
                assigned: false
            }
        );

    }


    const table =
        seatingRegistry
            .tables[
                assignment.tableId
            ];


    if (
        !table ||
        !table.name
    ) {

        return jsonResponse(
            {
                published: true,
                assigned: false
            }
        );

    }


    return jsonResponse(
        {
            published: true,
            assigned: true,
            tableName:
                table.name
        }
    );

}