import {
    getStore
} from "@netlify/blobs";


const INVITATION_STORE_NAME =
    "wedding-invitations";

const INVITATION_REGISTRY_KEY =
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


function cleanText(
    value,
    maxLength = 2000
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


async function getInvitationRegistry(
    store
) {

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
        !registry.invitations
    ) {

        return {
            version: 1,
            invitations: {}
        };

    }


    return registry;

}


async function getRsvpRegistry(
    store
) {

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
        !registry.rsvps
    ) {

        return {
            version: 1,
            rsvps: {}
        };

    }


    return registry;

}


async function removeSeatingAssignment(
    invitationCode
) {

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
            "object" ||
        !registry.assignments ||
        typeof registry.assignments !==
            "object" ||
        !registry.assignments[
            invitationCode
        ]
    ) {

        return;

    }


    delete registry
        .assignments[
            invitationCode
        ];

    registry.updatedAt =
        new Date()
            .toISOString();


    await store.setJSON(
        SEATING_REGISTRY_KEY,
        registry
    );

}


export default async function (
    request
) {

    if (
        request.method !==
        "POST"
    ) {

        return jsonResponse(
            {
                error:
                    "Method not allowed."
            },
            405
        );

    }


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


    const invitationCode =
        String(
            body.invitationCode ||
            ""
        )
            .trim();

    const attendance =
        String(
            body.attendance ||
            ""
        )
            .trim();

    const submittedGuests =
        String(
            body.guests ||
            "1"
        )
            .trim();

    const message =
        cleanText(
            body.message,
            2000
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


    if (
        attendance !== "Yes" &&
        attendance !== "No"
    ) {

        return jsonResponse(
            {
                error:
                    "Please select whether you will be attending."
            },
            400
        );

    }


    const allowedGuestCounts =
        new Set(
            [
                "1",
                "2",
                "3",
                "4",
                "5+"
            ]
        );


    if (
        attendance === "Yes" &&
        !allowedGuestCounts.has(
            submittedGuests
        )
    ) {

        return jsonResponse(
            {
                error:
                    "Invalid guest count."
            },
            400
        );

    }


    const invitationStore =
        getStore(
            INVITATION_STORE_NAME
        );

    const invitationRegistry =
        await getInvitationRegistry(
            invitationStore
        );

    const invitation =
        invitationRegistry
            .invitations[
                invitationCode
            ];


    if (
        !invitation ||
        !invitation.name
    ) {

        return jsonResponse(
            {
                error:
                    "Invalid invitation link."
            },
            404
        );

    }


    const rsvpStore =
        getStore(
            RSVP_STORE_NAME
        );

    const rsvpRegistry =
        await getRsvpRegistry(
            rsvpStore
        );

    const existingRsvp =
        rsvpRegistry
            .rsvps[
                invitationCode
            ];

    const now =
        new Date()
            .toISOString();

    const guests =
        attendance === "Yes"
            ? submittedGuests
            : "0";


    rsvpRegistry
        .rsvps[
            invitationCode
        ] = {

            invitationCode,

            guestName:
                invitation.name,

            attendance,

            guests,

            message,

            submittedAt:
                existingRsvp &&
                existingRsvp.submittedAt
                    ? existingRsvp.submittedAt
                    : now,

            updatedAt:
                now

        };


    await rsvpStore.setJSON(
        RSVP_REGISTRY_KEY,
        rsvpRegistry
    );


    if (
        attendance ===
        "No"
    ) {

        await removeSeatingAssignment(
            invitationCode
        );

    }


    return jsonResponse(
        {
            success:
                true,

            invitationCode,

            guestName:
                invitation.name,

            attendance,

            guests,

            updated:
                Boolean(
                    existingRsvp
                )
        }
    );

}
