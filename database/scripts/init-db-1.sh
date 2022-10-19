#!/bin/bash

# Loading dump list from remote server to the container.
curl -u :$REMOTE_API_KEY --output /var/dumps.json https://api.elephantsql.com/api/backup?db=$REMOTE_DATABASE_NAME;
# Get the latest date from the dumps array.
DUMP_URL=$(jq 'max_by(.backup_date) | .url' /var/dumps.json -r);
# Downloading the last dump.
curl $DUMP_URL --output /var/dump.lzo



# Create an empty database.
psql -U postgres -c "DROP DATABASE IF EXISTS personal_app_db WITH (FORCE);";
psql -U postgres -c "CREATE DATABASE personal_app_db ENCODING 'UTF-8';";



# Seed the database with the downloaded dump data.
lzop -cd /var/dump.lzo | psql -U postgres personal_app_db;
