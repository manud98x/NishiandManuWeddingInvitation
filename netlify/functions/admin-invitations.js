fetch(
    "/.netlify/functions/admin-invitations",
    {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-admin-secret":
                sessionStorage.getItem(
                    "weddingInviteAdminSecret"
                )
        },
        body: JSON.stringify({
            restoreCode:
                "rAnhOKY0m-WoIqzj",

            restoreName:
                "Gaston and Janine"
        })
    }
)
.then(r => r.json())
.then(console.log);