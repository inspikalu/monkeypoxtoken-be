import express, { Request, Response } from "express";
import { createToken } from "../controllers/createToken";
import { deployCollection } from "../controllers/deployCollection";
import { mintCollectionNFT } from "../controllers/mintNFT";
import { validateTokenMetadata } from "../middlewares/validateTokenMetadata";
import { sseMiddleware } from "../middlewares/sse";

const router = express.Router();

// SSE endpoint
router.get("/events/:clientId", sseMiddleware);

// Basic route
router.get("/", (req: Request, res: Response): void => {
  res.send("Hello World!");
});

// Endpoint to create a token
// router.post("/create/token", validateTokenMetadata, async (req, res) => {
router.post("/create/token", async (req, res) => {
  console.log("In Create Token");
  await createToken(req, res);
});

// Endpoint to create an NFT collection
router.post("/create/collection", async (req, res) => {
  console.log("In Create Collection");
  await deployCollection(req, res);
});

// Endpoint to mint an NFT
router.post("/mint/nft", async (req, res) => {
  console.log("In Mint NFT");
  await mintCollectionNFT(req, res);
});

export default router;
