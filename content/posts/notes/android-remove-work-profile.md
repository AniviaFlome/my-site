---
title: "Android Remove Work Profile"
date: 2025-12-09
notes: ["Android"]
---

Work profiles can be bugged if creating session is interrupted. Solution:

`adb shell pm remove-user 10 --set-ephemeral-if-in-use via adb`

The user id (in this case 10) can be retrieved by using: 

`adb shell pm list users`

