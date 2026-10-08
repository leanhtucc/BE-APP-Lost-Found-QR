import { TokenPayload } from "../libs/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      guest?: { id: string; returnSessionId: string; oiat: number };
    }
  }
}

export {};
