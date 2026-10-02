const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Luxus Real Estate API',
            version: '1.0.0',
            description: 'API documentation for the Luxus Real Estate backend',
        },
        servers: [
            {
                url: `http://localhost:${process.env.PORT || 8000}`,
                description: 'Development server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
                cookieAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'token',
                }
            }
        },
    },
    apis: ['./routes/*.js', './controllers/*.js'],
};

const specs = swaggerJsdoc(options);

const setupSwagger = (app) => {
    if (process.env.ENABLE_DOCS === 'true' || process.env.NODE_ENV !== 'production') {
        app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs));
    }
};

module.exports = setupSwagger;
