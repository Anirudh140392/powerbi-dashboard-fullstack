import { updateUserAccess } from './src/services/adminService.js';

async function test() {
    try {
        console.log("Testing updateUserAccess...");
        // let's provide a fake id '99999999' so it prints "Pending access request not found."
        await updateUserAccess('99999999', 'allow', 'Test User');
        console.log("Success!");
    } catch (e) {
        console.error("Caught error:", e);
    }
}
test();
