import * as admin from 'firebase-admin';

// Đảm bảo không bị khởi tạo nhiều lần (lỗi phổ biến khi code re-compile)
if (!admin.apps.length) {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (!serviceAccountPath) {
    console.error('❌ FATAL ERROR: FIREBASE_SERVICE_ACCOUNT_PATH is not defined in .env');
  } else {
    try {
      // Đường dẫn phải tương đối tính từ thư mục chạy lúc dev hoặc build
      const serviceAccount = require(`../../${serviceAccountPath}`);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('✅ Firebase Admin SDK initialized successfully.');
    } catch (error: any) {
      console.error('❌ Failed to initialize Firebase Admin:', error.message);
    }
  }
}

export default admin;
