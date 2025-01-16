import { Request, Response } from "express";
import {
  generateSigner,
  keypairIdentity,
  publicKey,
} from "@metaplex-foundation/umi";
import {
  createCollection,
  mplCore,
  ruleSet,
} from "@metaplex-foundation/mpl-core";
import {
  fromWeb3JsKeypair,
  toWeb3JsPublicKey,
} from "@metaplex-foundation/umi-web3js-adapters";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { Connection, Keypair } from "@solana/web3.js";
import { sendProgressUpdate } from "../utils/progress";

// Define the creator interface
interface Creator {
  address: string;
  percentage: number;
}

// Define the request body interface
interface CollectionRequestBody {
  name: string;
  uri: string;
  royaltyBasisPoints?: number;
  creators?: Creator[];
  privateKey: string; // base64 encoded private key
  rpcEndpoint?: string;
  clientId: string;
}

// Helper function to get wallet keypair from base64 private key
function getWalletKeypair(privateKey: string): Keypair {
  try {
    const privateKeyBytes = Buffer.from(privateKey, "base64");
    return Keypair.fromSecretKey(privateKeyBytes);
  } catch (error) {
    throw new Error("Invalid private key format. Must be base64 encoded.");
  }
}

export async function deployCollection(req: Request, res: Response) {
  const clientId = req.body.clientId;

  try {
    const {
      name,
      uri,
      royaltyBasisPoints,
      creators,
      privateKey,
      rpcEndpoint = "https://api.mainnet-beta.solana.com",
    }: CollectionRequestBody = req.body;
    console.log("Received request body:", {
      ...req.body,
      privateKey: "REDACTED",
    });

    sendProgressUpdate(clientId, {
      type: "collection",
      status: "started",
      message: "Starting collection deployment process",
    });

    // Validation progress
    sendProgressUpdate(clientId, {
      type: "collection",
      status: "progress",
      step: "validation",
      progress: 20,
      message: "Validating input parameters",
    });

    // Validate required fields
    if (!name || !uri || !privateKey) {
      return res
        .status(400)
        .json({ error: "Missing required fields: name, uri, or privateKey" });
    }

    // Wallet initialization progress
    sendProgressUpdate(clientId, {
      type: "collection",
      status: "progress",
      step: "wallet_init",
      progress: 40,
      message: "Initializing wallet",
    });
    // Get wallet keypair from provided base64 private key
    let walletKeypair: Keypair;
    try {
      walletKeypair = getWalletKeypair(privateKey);
    } catch (error: any) {
      return res.status(400).json({
        error: error.message,
      });
    }

    sendProgressUpdate(clientId, {
      type: "collection",
      status: "progress",
      step: "connection",
      progress: 60,
      message: "Setting up blockchain connection",
    });
    const connection = new Connection(rpcEndpoint);

    // Initialize Umi
    const umi = createUmi(connection.rpcEndpoint).use(mplCore());
    umi.use(keypairIdentity(fromWeb3JsKeypair(walletKeypair)));

    sendProgressUpdate(clientId, {
      type: "collection",
      status: "progress",
      step: "preparation",
      progress: 70,
      message: "Preparing collection parameters",
    });

    // Generate collection signer
    const collectionSigner = generateSigner(umi);

    // Format creators if provided
    const formattedCreators = creators?.map((creator: Creator) => ({
      address: publicKey(creator.address),
      percentage: creator.percentage,
    })) || [
      {
        address: publicKey(walletKeypair.publicKey.toString()),
        percentage: 100,
      },
    ];

    sendProgressUpdate(clientId, {
      type: "collection",
      status: "progress",
      step: "deployment",
      progress: 80,
      message: "Deploying collection to blockchain",
    });

    // Create collection
    const tx = await createCollection(umi, {
      collection: collectionSigner,
      name: name,
      uri: uri,
      plugins: [
        {
          type: "Royalties",
          basisPoints: royaltyBasisPoints || 500,
          creators: formattedCreators,
          ruleSet: ruleSet("None"),
        },
      ],
    }).sendAndConfirm(umi);

    // Success progress update
    sendProgressUpdate(clientId, {
      type: "collection",
      status: "completed",
      progress: 100,
      message: "Collection deployed successfully",
    });

    return res.status(200).json({
      collectionAddress: toWeb3JsPublicKey(
        collectionSigner.publicKey
      ).toString(),
      signature: tx.signature.toString(),
    });
  } catch (error: any) {
    // Error progress update
    sendProgressUpdate(clientId, {
      type: "collection",
      status: "error",
      message: `Collection deployment failed: ${error.message}`,
    });
    console.error("Collection deployment error:", error);
    return res
      .status(500)
      .json({ error: `Collection deployment failed: ${error.message}` });
  }
}

/**
 * Testing Instructions
 *
 * 1. Setup
 * - The endpoint accepts POST requests at /create/collection (adjust based on your route)
 *
 * 2. Required Request Body Parameters:
 * {
 *   "name": "Your Collection Name",
 *   "uri": "https://arweave.net/your-metadata-uri",
 *   "privateKey": "your-base64-encoded-private-key"
 * }
 *
 * 3. Optional Parameters:
 * {
 *   "royaltyBasisPoints": 500,  // 5% royalty (500 basis points)
 *   "rpcEndpoint": "https://api.mainnet-beta.solana.com",  // default if not provided
 *   "creators": [
 *     {
 *       "address": "creator-wallet-address",
 *       "percentage": 100
 *     }
 *   ]
 * }
 *
 * 4. To convert your private key to base64:
 * If you have a JSON keypair file:
 * ```typescript
 * const fs = require('fs');
 * const keypairData = fs.readFileSync('/path/to/keypair.json');
 * const base64Key = Buffer.from(keypairData).toString('base64');
 * console.log(base64Key); // Use this in your request
 * ```
 *
 * If you have a private key array:
 * ```typescript
 * const privateKeyBytes = new Uint8Array([your_private_key_numbers]);
 * const base64Key = Buffer.from(privateKeyBytes).toString('base64');
 * ```
 *
 * 5. Testing with cURL:
 * ```bash
 * curl -X POST http://your-api-endpoint/create/collection \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "name": "Test Collection",
 *     "uri": "https://arweave.net/your-metadata",
 *     "privateKey": "your-base64-private-key",
 *     "royaltyBasisPoints": 500,
 *     "rpcEndpoint": "https://api.mainnet-beta.solana.com",
 *     "creators": [
 *       {
 *         "address": "creator-wallet-address",
 *         "percentage": 100
 *       }
 *     ]
 *   }'
 * ```
 *
 * 6. Successful Response Format:
 * {
 *   "collectionAddress": "collection-address-here",
 *   "signature": "transaction-signature-here"
 * }
 *
 * 7. Error Response Format:
 * {
 *   "error": "Error message here"
 * }
 *
 * 8. Common Error Cases:
 * - 400: Missing required fields (name, uri, or privateKey)
 * - 400: Invalid private key format (must be base64 encoded)
 * - 500: Collection deployment failed (network issues, etc.)
 *
 * Note: Make sure to keep your private key secure and never expose it in client-side code.
 * Best practice is to handle the private key securely on the server side.
 */
