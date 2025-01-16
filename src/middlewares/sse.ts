import { Request, Response, NextFunction } from "express";

export interface SSEClient {
  id: string;
  response: Response;
}

class SSEManager {
  private clients: Map<string, SSEClient>;

  constructor() {
    this.clients = new Map();
  }

  addClient(client: SSEClient) {
    this.clients.set(client.id, client);
  }

  removeClient(clientId: string) {
    this.clients.delete(clientId);
  }

  sendToClient(clientId: string, data: any) {
    const client = this.clients.get(clientId);
    if (client) {
      client.response.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  }

  broadcast(data: any) {
    this.clients.forEach((client) => {
      client.response.write(`data: ${JSON.stringify(data)}\n\n`);
    });
  }
}

export const sseManager = new SSEManager();

export const sseMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const clientId = req.params.clientId || Date.now().toString();

  const client: SSEClient = {
    id: clientId,
    response: res,
  };

  sseManager.addClient(client);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: "connected", clientId })}\n\n`);

  // Handle client disconnect
  req.on("close", () => {
    sseManager.removeClient(clientId);
  });
};
