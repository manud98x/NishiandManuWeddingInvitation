import {
    getStore
} from "@netlify/blobs";

import {
    timingSafeEqual
} from "node:crypto";


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
    maxLength = 1000
) {

    return String(
        value || ""
    )
        .trim()
        .slice(
            0,
            maxLength
        );

}


function validGuestCount(
    value
) {

    return [
        "1",
        "2",
        "3",
        "4",
        "5+"
    ].includes(
        String(
            value
        )
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
        !registry.invitations
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
        !registry.rsvps
    ) {

        return {
            version: 1,
            rsvps: {}
        };

    }


    return registry;

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
        ? number
        : 0;

}


function buildDashboard(
    invitationRegistry,
    rsvpRegistry
) {

    const rows =
        Object.entries(
            invitationRegistry.invitations
        )
            .map(
                (
                    [
                        code,
                        invitation
                    ]
                ) => {

                    const rsvp =
                        rsvpRegistry.rsvps[
                            code
                        ] || null;


                    return {
                        code,

                        name:
                            invitation.name ||
                            "",

                        createdAt:
                            invitation.createdAt ||
                            null,

                        status:
                            rsvp
                                ? rsvp.attendance
                                : "Pending",

                        guestCount:
                            rsvp &&
                            rsvp.attendance === "Yes"
                                ? rsvp.guests
                                : (
                                    rsvp &&
                                    rsvp.attendance === "No"
                                        ? "0"
                                        : ""
                                ),

                        message:
                            rsvp
                                ? (
                                    rsvp.message ||
                                    ""
                                )
                                : "",

                        adminNote:
                            rsvp
                                ? (
                                    rsvp.adminNote ||
                                    ""
                                )
                                : "",

                        source:
                            rsvp
                                ? (
                                    rsvp.source ||
                                    "guest"
                                )
                                : "",

                        submittedAt:
                            rsvp
                                ? (
                                    rsvp.submittedAt ||
                                    null
                                )
                                : null,

                        updatedAt:
                            rsvp
                                ? (
                                    rsvp.updatedAt ||
                                    null
                                )
                                : null
                    };

                }
            )
            .sort(
                (
                    a,
                    b
                ) =>
                    a.name.localeCompare(
                        b.name
                    )
            );


    const attending =
        rows.filter(
            row =>
                row.status === "Yes"
        );

    const declined =
        rows.filter(
            row =>
                row.status === "No"
        );

    const pending =
        rows.filter(
            row =>
                row.status === "Pending"
        );


    const totalAttendingPeople =
        attending.reduce(
            (
                total,
                row
            ) =>
                total +
                numericGuestCount(
                    row.guestCount
                ),
            0
        );


    return {
        rows,

        summary: {
            invitations:
                rows.length,

            responded:
                attending.length +
                declined.length,

            attendingInvitations:
                attending.length,

            declinedInvitations:
                declined.length,

            pendingInvitations:
                pending.length,

            attendingPeople:
                totalAttendingPeople
        }
    };

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


    if (
        request.method ===
        "GET"
    ) {

        const [
            invitationRegistry,
            rsvpRegistry
        ] =
            await Promise.all(
                [
                    getInvitationRegistry(),
                    getRsvpRegistry()
                ]
            );


        return jsonResponse(
            buildDashboard(
                invitationRegistry,
                rsvpRegistry
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


        const invitationCode =
            cleanText(
                body.code,
                180
            );

        const attendance =
            cleanText(
                body.attendance,
                10
            );

        const guests =
            cleanText(
                body.guests,
                10
            );

        const message =
            cleanText(
                body.message,
                2000
            );

        const adminNote =
            cleanText(
                body.adminNote,
                1000
            );


        if (
            !invitationCode
        ) {

            return jsonResponse(
                {
                    error:
                        "Select an invitation."
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
                        "Attendance must be Yes or No."
                },
                400
            );

        }


        if (
            attendance === "Yes" &&
            !validGuestCount(
                guests
            )
        ) {

            return jsonResponse(
                {
                    error:
                        "Choose the number of guests attending."
                },
                400
            );

        }


        const [
            invitationRegistry,
            rsvpRegistry
        ] =
            await Promise.all(
                [
                    getInvitationRegistry(),
                    getRsvpRegistry()
                ]
            );


        const invitation =
            invitationRegistry
                .invitations[
                    invitationCode
                ];


        if (
            !invitation
        ) {

            return jsonResponse(
                {
                    error:
                        "Invitation not found."
                },
                404
            );

        }


        const existing =
            rsvpRegistry.rsvps[
                invitationCode
            ] || null;

        const now =
            new Date()
                .toISOString();


        rsvpRegistry.rsvps[
            invitationCode
        ] = {

            invitationCode,

            guestName:
                invitation.name,

            attendance,

            guests:
                attendance === "Yes"
                    ? guests
                    : "0",

            message,

            adminNote,

            source:
                "manual-admin",

            submittedAt:
                existing &&
                existing.submittedAt
                    ? existing.submittedAt
                    : now,

            updatedAt:
                now
        };


        const store =
            getStore(
                RSVP_STORE_NAME
            );


        await store.setJSON(
            RSVP_REGISTRY_KEY,
            rsvpRegistry
        );


        return jsonResponse(
            {
                saved: true,

                ...buildDashboard(
                    invitationRegistry,
                    rsvpRegistry
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


        const invitationCode =
            cleanText(
                body.code,
                180
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
            rsvpRegistry
        ] =
            await Promise.all(
                [
                    getInvitationRegistry(),
                    getRsvpRegistry()
                ]
            );


        if (
            !rsvpRegistry.rsvps[
                invitationCode
            ]
        ) {

            return jsonResponse(
                {
                    error:
                        "RSVP not found."
                },
                404
            );

        }


        delete rsvpRegistry.rsvps[
            invitationCode
        ];


        const store =
            getStore(
                RSVP_STORE_NAME
            );


        await store.setJSON(
            RSVP_REGISTRY_KEY,
            rsvpRegistry
        );


        return jsonResponse(
            {
                deleted: true,

                ...buildDashboard(
                    invitationRegistry,
                    rsvpRegistry
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