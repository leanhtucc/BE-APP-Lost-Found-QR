import * as admin from "firebase-admin";
import fs from "fs";
import path from "path";

type ServiceAccountInput = {
  project_id?: string;
  projectId?: string;
  private_key?: string;
  privateKey?: string;
  client_email?: string;
  clientEmail?: string;
};

const toServiceAccount = (
  input: ServiceAccountInput
): admin.ServiceAccount => ({
  projectId: input.projectId || input.project_id,
  privateKey: (input.privateKey || input.private_key || "").replace(
    /\\n/g,
    "\n"
  ),
  clientEmail: input.clientEmail || input.client_email,
});

const loadFromEnv = (): admin.ServiceAccount | null => {
  const rawJson =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.FIREBASE_SERVICE_ACCOUNT;
  if (rawJson) {
    try {
      return toServiceAccount(JSON.parse(rawJson) as ServiceAccountInput);
    } catch (error: any) {
      console.error(
        "❌ FIREBASE_SERVICE_ACCOUNT_JSON is invalid JSON:",
        error.message
      );
    }
  }

  const rawBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (rawBase64) {
    try {
      const decoded = Buffer.from(rawBase64, "base64").toString("utf8");
      return toServiceAccount(JSON.parse(decoded) as ServiceAccountInput);
    } catch (error: any) {
      console.error(
        "❌ FIREBASE_SERVICE_ACCOUNT_BASE64 is invalid:",
        error.message
      );
    }
  }

  return null;
};

const loadFromFile = (
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
    return toServiceAccount(JSON.parse(content) as ServiceAccountInput);
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
  const serviceAccountPath = process.env.FIREBASE_CONFIG_PATH;
  const serviceAccountFromEnv = loadFromEnv();

  if (serviceAccountFromEnv) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountFromEnv),
      });
      console.log("✅ Firebase Admin SDK initialized successfully from ENV.");
    } catch (error: any) {
      console.error(
        "❌ Failed to initialize Firebase Admin from ENV:",
        error.message
      );
    }
  } else if (!serviceAccountPath) {
    console.error(
      "❌ FATAL ERROR: FIREBASE_CONFIG_PATH is not defined in .env"
    );
    console.error(
      "ℹ️  Set FIREBASE_SERVICE_ACCOUNT_JSON on Render to avoid file-path issues."
    );
  } else {
    const serviceAccount = loadFromFile(serviceAccountPath);

    if (serviceAccount) {
      try {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log(
          "✅ Firebase Admin SDK initialized successfully from file path."
        );
      } catch (error: any) {
        console.error(
          "❌ Failed to initialize Firebase Admin from file:",
          error.message
        );
      }
    }
  }
}

export default admin;
