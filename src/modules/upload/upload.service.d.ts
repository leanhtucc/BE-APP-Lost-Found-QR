/**
 * Upload Service
 * Handle file operations
 */
export declare class UploadService {
    private readonly uploadDir;
    uploadImage(file: Express.Multer.File, userId: string): Promise<{
        filename: string;
        originalName: string;
        size: number;
        mimeType: string;
        url: string;
        uploadedBy: string;
    }>;
    deleteFile(filename: string, userId: string): Promise<void>;
}
//# sourceMappingURL=upload.service.d.ts.map