import { getStore } from "@netlify/blobs";



const STORE_NAME =
    "wedding-invitations";

const REGISTRY_KEY =
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



async function getRegistry() {

    const store =
        getStore(
            STORE_NAME
        );



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



export default async function (
    request
) {

    if (
        request.method !==
        "GET"
    ) {

        return jsonResponse(
            {
                valid: false,
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



    const code =
        (
            url
                .searchParams
                .get(
                    "code"
                ) ||
            ""
        )
            .trim();



    if (
        !code
    ) {

        return jsonResponse(
            {
                valid: false
            },
            404
        );

    }



    const registry =
        await getRegistry();



    const invitation =
        registry
            .invitations[
                code
            ];



    if (
        !invitation ||
        !invitation.name
    ) {

        return jsonResponse(
            {
                valid: false
            },
            404
        );

    }



    return jsonResponse(
        {
            valid: true,

            name:
                invitation.name
        }
    );

}
