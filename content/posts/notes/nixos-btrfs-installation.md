---
title: "NixOS Btrfs Installation"
date: 2025-12-09
notes: ["Linux", "NixOS", "Scripts"]
---

```bash
#!/usr/bin/env bash

# Define your partitions here
BOOT_PARTITION="/dev/sdX1"
ROOT_PARTITION="/dev/sdX2"

# Bootloader format
mkfs.fat -F 32 $BOOT_PARTITION

# Disk Format
mkfs.btrfs $ROOT_PARTITION

mkdir -p /mnt
mount $ROOT_PARTITION /mnt
btrfs subvolume create /mnt/@
btrfs subvolume create /mnt/@home
btrfs subvolume create /mnt/@nix
umount /mnt

mount -o compress=zstd,subvol=@ $ROOT_PARTITION /mnt
mkdir /mnt/{home,nix}
mount -o compress=zstd,subvol=@home $ROOT_PARTITION /mnt/home
mount -o compress=zstd,noatime,subvol=@nix $ROOT_PARTITION /mnt/nix

mkdir /mnt/boot
mount $BOOT_PARTITION /mnt/boot

nixos-generate-config --root /mnt

# nixos-install
```
