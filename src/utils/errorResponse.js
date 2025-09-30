class ErrorResponse extends Error {
    constructor(message, statusCode, hindi_message = null) {
      super(message);
      this.statusCode = statusCode;
      this.hindi_message = hindi_message || 'त्रुटि';
    }
  }
  
  module.exports = ErrorResponse;