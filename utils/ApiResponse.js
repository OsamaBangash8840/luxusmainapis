const { MESSAGES } = require('../config/constants');

class ApiResponse {
    constructor(statusCode, data, message = MESSAGES.SUCCESS.DEFAULT) {
        this.statusCode = statusCode;
        this.data = data;
        this.message = message;
        this.success = statusCode < 400;
    }
}

module.exports = ApiResponse;
