import { sseManager } from "../middlewares/sse";

export interface ProgressUpdate {
  type: "token" | "collection" | "nft";
  status: "started" | "progress" | "completed" | "error";
  step?: string;
  progress?: number;
  message?: string;
  error?: string;
}

export const sendProgressUpdate = (
  clientId: string,
  update: ProgressUpdate
) => {
  sseManager.sendToClient(clientId, update);
};
