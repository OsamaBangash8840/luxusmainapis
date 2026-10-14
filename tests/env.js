// Loaded via jest setupFiles, which runs BEFORE any test file imports app.js.
// config/env.js exits the process if required variables are missing, so CI
// (which has no .env file) needs these test-only values set up front.
const testEnv = {
    NODE_ENV: 'test',
    MONGO_URI: 'mongodb://127.0.0.1:27017/luxus-test',
    TOKEN_SECRET: 'test-secret',
    VERIFICATION_SECRET: 'test-secret',
    GOOGLE_SIGNUP_SECRET: 'google-secret',
    FRONTEND_URL: 'http://localhost:3000',
    EMAIL: 'test@example.com',
    APP_PASSWORD: 'test',
};

for (const [key, value] of Object.entries(testEnv)) {
    process.env[key] = value;
}
