# VM template and commands

Disk image is: `foundationdb-6-2-20`
VM template is: `foundationdb`

Specs:
* CPU/Memory - 2 vCPU/7.5GB - n1-standart-v2
* Boot Disk - 32GB
* Local SSD - 375 GB

## Commissioning:
1) `sudo fdb_mount` - Format and mount Local SSD disk
2) `sudo fdb_prepare` - Create required directories for foundationdb
3) Configure roles, dc_id, etc, provide fdb.cluster
4) `sudo fdb_start` - Enable and start foundationdb