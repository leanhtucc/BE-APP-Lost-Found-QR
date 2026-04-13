import * as admin from "firebase-admin";
import fs from "fs";
import path from "path";

const loadServiceAccountFromFile = (
  serviceAccountPath: string
): admin.ServiceAccount | null => {
  const candidatePaths = [
    path.resolve(process.cwd(), serviceAccountPath),
    path.resolve(process.cwd(), "firebase", serviceAccountPath),
    path.resolve(__dirname, "../../", serviceAccountPath),
    path.resolve(__dirname, "../../firebase", serviceAccountPath),
  ];

  const existingPath = candidatePaths.find((candidate) =>
    fs.existsSync(candidate)
  );
  if (!existingPath) {
    console.error(
      "❌ Firebase service account file not found. Checked paths:",
      candidatePaths.join(", ")
    );
    return null;
  }

  try {
    const content = fs.readFileSync(existingPath, "utf8");
    return JSON.parse(content) as admin.ServiceAccount;
  } catch (error: any) {
    console.error(
      "❌ Failed to read Firebase service account file:",
      error.message
    );
    return null;
  }
};

// Đảm bảo không bị khởi tạo nhiều lần (lỗi phổ biến khi code re-compile)
if (!admin.apps.length) {
  const serviceAccountPath =
    process.env.FIREBASE_CONFIG_PATH ||
    "firebase/api-phone-number-for-firebase-adminsdk-fbsvc-6472cb491d.json";

  const serviceAccount = loadServiceAccountFromFile(serviceAccountPath);

  if (serviceAccount) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("✅ Firebase Admin SDK initialized successfully.");
    } catch (error: any) {
      console.error("❌ Failed to initialize Firebase Admin:", error.message);
    }
  } else {
    console.error(
      "❌ Firebase Admin SDK not initialized. Check FIREBASE_CONFIG_PATH and service account file."
    );
  }
}

export default admin;
