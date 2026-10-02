# Backend Architecture Overview

This document provides a comprehensive guide to understanding the backend architecture of the Luxus application. It is designed to help new developers quickly get up to speed with the codebase, key patterns, and workflows.

## 1. Technology Stack

- **Runtime Environment:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB (using Mongoose ODM)
- **Authentication:** JWT (JSON Web Tokens) and Cookies
- **Main Dependencies:**
    - `bcryptjs`: Password hashing
    - `multer`: File handling (image uploads)
    - `socket.io`: Real-time features
    - `nodemailer`: Email services
    - `joi` & `express-validator`: Validation

## 2. Project Structure

The project follows the **MVC (Model-View-Controller)** separation of concerns (though "View" is the API response):

```
server_clone/
├── config/             # Configuration files (DB connection, constants)
├── controllers/        # Logic for handling API requests
├── middlewares/        # Express middlewares (Auth, validation)
├── models/             # Mongoose schemas/models
├── routes/             # API route definitions
├── utils/              # Helper functions (AsyncHandler, ApiError, Logger)
├── helpers/            # Business logic helpers (Auth helper)
├── app.js              # Entry point, app setup, middleware mounting
└── package.json        # Dependencies and scripts
```

## 3. Key Concepts & Patterns

### 3.1. Entry Point (`app.js`)
- Initializes the Express app.
- Connects to MongoDB (`./config/db`).
- Sets up global middleware:
    - **CORS**: Configured to allow requests from `http://localhost:3000`.
    - **Cookie Parser**: Used for reading authentication tokens.
    - **Static Files**: Serves uploads from the `/uploads` directory.
- Mounts routes under the `/api` prefix (e.g., `/api/properties`).

### 3.2. Response Handling
The application uses standardized classes to ensure consistent API responses:
- **`ApiResponse`**: Used for successful responses.
    - *Structure*: `{ statusCode, data, message, success: true }`
- **`ApiError`**: Custom error class for handling exceptions.
    - *Structure*: `{ statusCode, message, errors, success: false }`
- **`asyncHandler`**: A wrapper function used in controllers to automatically catch asynchronous errors and pass them to the global error handler, avoiding repetitive `try-catch` blocks.

### 3.3. Authentication Flow
- **Registration**: User signs up -> Password hashed -> User saved -> Verification Email sent.
- **Login**: User logs in -> Password compared -> JWT generated -> Token set in **HTTP-only Cookie**.
- **Protection**: `verifyToken` middleware checks the cookie for a valid JWT before allowing access to protected routes.

### 3.4. File Uploads
- **Multer** is used to handle `multipart/form-data`.
- Files are saved locally to the `uploads/` directory with unique timestamps.
- Controllers receive file paths to store in the database.

## 4. Workflows

### 4.1. Adding a Property
1.  **Route**: `POST /api/properties` triggers `propertyRoutes.js`.
2.  **Middleware**: `verifyToken` ensures the user is logged in.
3.  **Controller**: `addProperty` in `property.controller.js`:
    - Validates inputs.
    - Finds the `Category` by name.
    - Creates a new `Property` document linked to the `User` (seller).
    - Saves to DB and returns success.

### 4.2. Searching Properties
1.  **Route**: `GET /api/properties/search`.
2.  **Controller**: `searchProperty` builds a dynamic MongoDB query based on query params:
    - `search` (RegExp on title/description).
    - `minPrice` / `maxPrice`.
    - `category` (Looked up by name).
    - `location`.
    - Implements **Pagination** (limit/skip).

## 5. Getting Started

### Prerequisites
- Node.js installed.
- MongoDB running locally or a generic connection string.

### Setup
1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Environment Variables**:
    Create a `.env` file with:
    ```env
    PORT=6000
    MONGO_URI=your_mongo_connection_string
    TOKEN_SECRET=your_jwt_secret
    # Add other secrets (Cloudinary, Email, etc.)
    ```
3.  **Run Development Server**:
    ```bash
    npm run start
    # or
    nodemon app.js
    ```
    API will run on `http://localhost:6000`.
