import {
  cert,
  getApps,
  initializeApp,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";
import fs from "fs";
import path from "path";
import { logger } from "../libs/logger";
import { ENV } from "./env";

type RawServiceAccount = {
  project_id?: string;
  projectId?: string;
  client_email?: string;
  clientEmail?: string;
  private_key?: string;
  privateKey?: string;
};

function normalizeServiceAccount(raw: RawServiceAccount): ServiceAccount {
  const projectId = raw.projectId || raw.project_id;
  const clientEmail = raw.clientEmail || raw.client_email;
  const privateKey = (raw.privateKey || raw.private_key || "").replace(
    /\\n/g,
    "\n"
  );

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase service account must include project ID, client email and private key"
    );
  }

  return { projectId, clientEmail, privateKey };
}

function resolveServiceAccountPath(configPath: string): string | null {
  const candidates = path.isAbsolute(configPath)
    ? [configPath]
    : [
        path.resolve(process.cwd(), configPath),
        path.resolve(process.cwd(), "firebase", configPath),
      ];

  return (
    [...new Set(candidates)].find((candidate) => fs.existsSync(candidate)) ??
    null
  );
}

function loadServiceAccount(): ServiceAccount | null {
  if (ENV.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return normalizeServiceAccount(
      JSON.parse(ENV.FIREBASE_SERVICE_ACCOUNT_JSON) as RawServiceAccount
    );
  }

  if (
    ENV.FIREBASE_PROJECT_ID &&
    ENV.FIREBASE_CLIENT_EMAIL &&
    ENV.FIREBASE_PRIVATE_KEY
  ) {
    return normalizeServiceAccount({
      projectId: ENV.FIREBASE_PROJECT_ID,
      clientEmail: ENV.FIREBASE_CLIENT_EMAIL,
      privateKey: ENV.FIREBASE_PRIVATE_KEY,
    });
  }

  if (!ENV.FIREBASE_CONFIG_PATH) return null;

  const serviceAccountPath = resolveServiceAccountPath(
    ENV.FIREBASE_CONFIG_PATH
  );
  if (!serviceAccountPath) {
    throw new Error(
      `Service account file was not found at ${ENV.FIREBASE_CONFIG_PATH}`
    );
  }

  return normalizeServiceAccount(
    JSON.parse(fs.readFileSync(serviceAccountPath, "utf8")) as RawServiceAccount
  );
}

function initializeFirebaseAdmin(): void {
  if (getApps().length) return;

  try {
    const serviceAccount = loadServiceAccount();
    if (!serviceAccount) {
      logger.info(
        "Firebase Admin is disabled (no service account is configured)"
      );
      return;
    }

    initializeApp({ credential: cert(serviceAccount) });
    logger.info("Firebase Admin initialized successfully");
  } catch (error) {
    logger.warn(
      "Firebase Admin is disabled",
      error instanceof Error ? error.message : error
    );
  }
}

initializeFirebaseAdmin();

const firebaseAdmin = {
  get apps() {
    return getApps();
  },
  auth: getAuth,
  messaging: getMessaging,
};

export default firebaseAdmin;
