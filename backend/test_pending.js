import * as adminService from './src/services/adminService.js';
adminService.getPendingRequests()
  .then(res => console.log('Success:', res))
  .catch(err => console.error('Error:', err));
