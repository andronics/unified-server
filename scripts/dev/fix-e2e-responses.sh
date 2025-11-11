#!/bin/bash

# Fix user-journey.test.ts
echo "Fixing user-journey.test.ts..."

# Fix adminToken section around line 371
sed -i '371s/.*/      \/\/ Login to get token\n      const adminLogin = await request(app)\n        .post("\/api\/auth\/login")\n        .send({\n          email: "admin.e2e@example.com",\n          password: "SecurePass123!",\n        });\n      const adminToken = adminLogin.body.data.token;/' tests/e2e/user-journey.test.ts

# Fix newUserToken section around line 415
sed -i '415s/.*/      const newUserId = newUser.body.data.id;\n      \/\/ Login to get token\n      const newUserLogin = await request(app)\n        .post("\/api\/auth\/login")\n        .send({\n          email: "newuser.e2e@example.com",\n          password: "SecurePass123!",\n        });\n      const newUserToken = newUserLogin.body.data.token;/' tests/e2e/user-journey.test.ts

# Fix newUserId reference
sed -i 's/newUser\.body\.data\.user\.id/newUser.body.data.id/g' tests/e2e/user-journey.test.ts

# Fix connection drops test around line 467-468
sed -i '467,468s/body\.data\.tokens\.accessToken/body.data.token/g' tests/e2e/user-journey.test.ts
sed -i 's/user\.body\.data\.user\.id/user.body.data.id/g' tests/e2e/user-journey.test.ts

# Fix rapid connection test around line 565
sed -i '565s/.*/      \/\/ Login to get token\n      const login = await request(app)\n        .post("\/api\/auth\/login")\n        .send({\n          email: "rapid.e2e@example.com",\n          password: "SecurePass123!",\n        });\n      const token = login.body.data.token;/' tests/e2e/user-journey.test.ts

# Fix event-propagation.test.ts
echo "Fixing event-propagation.test.ts..."

# Replace all register responses that expect tokens
sed -i 's/admin\.body\.data\.tokens\.accessToken/adminToken/g' tests/e2e/event-propagation.test.ts
sed -i 's/user1\.body\.data\.tokens\.accessToken/token1/g' tests/e2e/event-propagation.test.ts
sed -i 's/user2\.body\.data\.tokens\.accessToken/token2/g' tests/e2e/event-propagation.test.ts
sed -i 's/user\.body\.data\.tokens\.accessToken/token/g' tests/e2e/event-propagation.test.ts
sed -i 's/u\.body\.data\.tokens\.accessToken/u.token/g' tests/e2e/event-propagation.test.ts

# Fix user ID references
sed -i 's/\.body\.data\.user\.id/.body.data.id/g' tests/e2e/event-propagation.test.ts

echo "Fixes applied!"