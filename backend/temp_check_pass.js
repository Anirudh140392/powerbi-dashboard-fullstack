import bcrypt from 'bcrypt';

const hashAnirudh = "$2b$10$Tn7vzeeQIkXh04LcWuBj4.l/5XzzENMKewQlbbgDM3jrM1Y7nkEAO";
const hashDemo = "$2b$10$LYVEaUDFWpFq60jEhMPmQ.I8rThKRT9Ra8P6DBrCZHh70qr/YiTKm";

const passwords = [
  "Zydus@123#",
  "Trailytics@123",
  "Admin@123",
  "admin",
  "password",
  "123456",
  "12345678",
  "anirudh",
  "admin123",
  "demo",
  "demo@123",
  "demo123",
  "Admin@123#",
  "trailytics",
  "trailytics@123",
  "Trailytics@123#",
  "admin@123",
  "admin@123#"
];

async function check() {
  for (const pw of passwords) {
    if (await bcrypt.compare(pw, hashAnirudh)) {
      console.log("MATCH ANIRUDH:", pw);
    }
    if (await bcrypt.compare(pw, hashDemo)) {
      console.log("MATCH DEMO:", pw);
    }
  }
}
check();
