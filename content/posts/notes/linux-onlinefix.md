---
title: "Linux OnlineFix"
date: 2025-12-09
notes: ["Linux", "Gaming"]
---

Add game as a non steam game to steam, enable proton and add this steam parameter:
`WINEDLLOVERRIDES="OnlineFix64=n;SteamOverlay64=n;winmm=n,b;dnet=n;steam_api64=n" %command%`
