DEST=`date +%Y%m%d%H%M%S`
cp migrations.ts.template src/tables/migrations/$DEST-$1.ts