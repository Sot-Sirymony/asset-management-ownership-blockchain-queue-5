# From repo root: stop API on 8081, then start it again
lsof -ti :8081 | xargs kill 2>/dev/null; sleep 2
cd ownership-api-master && mvn spring-boot:run > api.log 2>&1 &




Token obtained. Calling GET /api/v1/user/getAllAsset ...

HTTP 200 OK
{
    "message": "Success",
    "payload": [
        {
            "assetId": "AssetSeed001",
            "assetName": "Seed Laptop",
            "qty": "1",
            "condition": "New",
            "attachment": "seed-attachment",
            "assignDate": "2026-03-08 07:03:09.122323297 +0000 UTC m=+141.529809023",
            "depName": "IT",
            "assignTo": {
                "userId": "1",
                "fullName": "",
                "profileImg": "",
                "department": ""
            }
        }
    ],
    "httpStatus": "OK",
    "timestamp": "2026-03-08T07:08:25.255+00:00"
}

--- Total assets: 1 ---
sotsirymony@Sots-MacBook-Pro All In One Source % 