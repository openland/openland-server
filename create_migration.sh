DEST=`date +%Y%m%d%H%M%S`
cp migrations.ts.template packages/openland-server/tables/migrations/$DEST-$1.ts