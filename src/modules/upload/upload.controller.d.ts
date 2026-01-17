import { NextFunction, Request, Response } from "express";
export declare class UploadController {
    uploadImage(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    deleteImage(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
}
export declare const uploadController: UploadController;
//# sourceMappingURL=upload.controller.d.ts.map