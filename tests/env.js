// Loaded via jest setupFiles, which runs BEFORE any test file imports app.js.
// Provides test-only fallback values so CI/testing environments without .env run smoothly.
const testEnv = {
    NODE_ENV: 'test',
    MONGO_URI: 'mongodb://127.0.0.1:27017/luxus-test',
    TOKEN_SECRET: 'test-secret',
    VERIFICATION_SECRET: 'test-secret',
    GOOGLE_SIGNUP_SECRET: 'google-secret',
    FRONTEND_URL: 'http://localhost:3000',
    EMAIL: 'test@example.com',
    APP_PASSWORD: 'test',
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    GOOGLE_CALLBACK_URL: 'http://localhost:8000/api/auth/google/callback',
    STRIPE_SECRET_KEY: 'sk_test_dummy',
    STRIPE_WEBHOOK_SECRET: 'whsec_dummy',
    CLOUDINARY_CLOUD_NAME: 'test-cloud',
    CLOUDINARY_API_KEY: 'test-key',
    CLOUDINARY_API_SECRET: 'test-secret'
};

for (const [key, value] of Object.entries(testEnv)) {
    if (!process.env[key]) {
        process.env[key] = value;
    }
}
