#!/bin/bash

email=<your_email>
password=<your_password>

auth=`curl -v  http://localhost:81/services/auth/login -d "email=$email&password=$password"`
tmp=${auth#*:}
tmp2=$(echo $tmp|cut -d',' -f 1)
ck=$(echo $tmp2|cut -d'"' -f 2)
echo "----Token---------"
echo $ck
curl -v --cookie "authorization=Bearer $ck" --request POST http://localhost:81/services/projects/update-cipres-jobs 
