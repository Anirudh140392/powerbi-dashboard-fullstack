// src/v1/helper/serviceResponse.js
export default class ServiceResponse {
  constructor({ success = true, message = "", data = null, error = null, status = 200 }) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.error = error;
    this.status = status;
  }

  static success(message = "Success", data = null, status = 200) {
    return new ServiceResponse({
      success: true,
      message,
      data,
      status,
    });
  }

  static error(message = "Error", error = null, status = 500) {
    return new ServiceResponse({
      success: false,
      message,
      error,
      status,
    });
  }
}
