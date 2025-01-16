// nftController.ts
import { Request, Response } from "express";
import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import { generateSigner, keypairIdentity } from "@metaplex-foundation/umi";
import {
  create,
  mplCore,
  fetchCollection,
} from "@metaplex-foundation/mpl-core";
import {
  fromWeb3JsKeypair,
  fromWeb3JsPublicKey,
  toWeb3JsPublicKey,
} from "@metaplex-foundation/umi-web3js-adapters";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { sendProgressUpdate } from "../utils/progress";

// Types for request body
interface MintNFTRequestBody {
  rpcEndpoint: string;
  privateKey: string; // base64 encoded private key
  collectionMint: string;
  metadata: {
    name: string;
    uri: string;
    sellerFeeBasisPoints?: number;
    creators?: Array<{
      address: string;
      share: number;
    }>;
  };
  recipient?: string;
  clientId: string;
}

// Types for response
interface MintNFTResponse {
  mint: string;
  metadata: string;
}

// Helper function to get wallet keypair from private key
function getWalletKeypair(privateKey: string): Keypair {
  try {
    const privateKeyBytes = Buffer.from(privateKey, "base64");
    return Keypair.fromSecretKey(privateKeyBytes);
  } catch (error) {
    throw new Error("Invalid private key format. Must be base64 encoded.");
  }
}

/**
 * Mint a new NFT as part of an existing collection
 */
export async function mintCollectionNFT(req: Request, res: Response) {
  const clientId = req.body.clientId;

  try {
    sendProgressUpdate(clientId, {
      type: "nft",
      status: "started",
      message: "Starting NFT minting process",
    });

    const {
      rpcEndpoint,
      privateKey,
      collectionMint,
      metadata,
      recipient,
    }: MintNFTRequestBody = req.body;

    sendProgressUpdate(clientId, {
      type: "nft",
      status: "progress",
      step: "validation",
      progress: 15,
      message: "Validating input parameters",
    });

    // Validate request body
    if (!rpcEndpoint) {
      sendProgressUpdate(clientId, {
        type: "nft",
        status: "error",
        message: "RPC endpoint is required",
      });
      return res.status(400).json({
        error: "RPC endpoint is required",
      });
    }

    if (!privateKey) {
      sendProgressUpdate(clientId, {
        type: "nft",
        status: "error",
        message: "Private key is required",
      });
      return res.status(400).json({
        error: "Private key is required",
      });
    }

    if (!collectionMint || !metadata.name || !metadata.uri) {
      sendProgressUpdate(clientId, {
        type: "nft",
        status: "error",
        message:
          "Missing required fields: collectionMint, metadata.name, or metadata.uri",
      });
      return res.status(400).json({
        error:
          "Missing required fields: collectionMint, metadata.name, or metadata.uri",
      });
    }

    sendProgressUpdate(clientId, {
      type: "nft",
      status: "progress",
      step: "connection",
      progress: 30,
      message: "Initializing blockchain connection",
    });

    // Initialize Solana connection with provided RPC endpoint
    const connection = new Connection(rpcEndpoint);

    // Validate RPC endpoint by testing connection
    try {
      await connection.getLatestBlockhash();
    } catch (error) {
      sendProgressUpdate(clientId, {
        type: "nft",
        status: "error",
        message: "Invalid RPC endpoint or connection failed",
      });
      return res.status(400).json({
        error: "Invalid RPC endpoint or connection failed",
      });
    }

    sendProgressUpdate(clientId, {
      type: "nft",
      status: "progress",
      step: "wallet_init",
      progress: 45,
      message: "Initializing wallet",
    });
    // Get wallet keypair from provided private key
    let walletKeypair: Keypair;
    try {
      walletKeypair = getWalletKeypair(privateKey);
    } catch (error: any) {
      sendProgressUpdate(clientId, {
        type: "nft",
        status: "error",
        message: error.message,
      });
      return res.status(400).json({
        error: error.message,
      });
    }

    // UMI initialization progress
    sendProgressUpdate(clientId, {
      type: "nft",
      status: "progress",
      step: "umi_init",
      progress: 60,
      message: "Initializing UMI and fetching collection",
    });
    // Create UMI instance with provided RPC endpoint
    const umi = createUmi(rpcEndpoint).use(mplCore());
    umi.use(keypairIdentity(fromWeb3JsKeypair(walletKeypair)));

    // Convert collection mint to PublicKey and then to UMI format
    const collectionMintPubkey = new PublicKey(collectionMint);
    const umiCollectionMint = fromWeb3JsPublicKey(collectionMintPubkey);

    // Collection verification progress
    sendProgressUpdate(clientId, {
      type: "nft",
      status: "progress",
      step: "collection_verification",
      progress: 75,
      message: "Verifying collection and preparing NFT",
    });

    // Fetch the existing collection
    const collection = await fetchCollection(umi, umiCollectionMint);

    // Generate a new signer for the NFT
    const assetSigner = generateSigner(umi);

    // NFT minting progress
    sendProgressUpdate(clientId, {
      type: "nft",
      status: "progress",
      step: "minting",
      progress: 90,
      message: "Minting NFT on blockchain",
    });

    // Create the NFT in the collection
    await create(umi, {
      asset: assetSigner,
      collection: collection,
      name: metadata.name,
      uri: metadata.uri,
      owner: recipient
        ? fromWeb3JsPublicKey(new PublicKey(recipient))
        : fromWeb3JsPublicKey(walletKeypair.publicKey),
    }).sendAndConfirm(umi);

    // Success progress update
    sendProgressUpdate(clientId, {
      type: "nft",
      status: "completed",
      progress: 100,
      message: "NFT minted successfully",
    });

    // Prepare response
    const response: MintNFTResponse = {
      mint: toWeb3JsPublicKey(assetSigner.publicKey).toBase58(),
      metadata: toWeb3JsPublicKey(assetSigner.publicKey).toBase58(),
    };

    return res.status(200).json(response);
  } catch (error: any) {
    // Error progress update
    sendProgressUpdate(clientId, {
      type: "nft",
      status: "error",
      message: `NFT minting failed: ${error.message}`,
    });
    console.error("NFT minting error:", error);
    return res.status(500).json({
      error: `NFT minting failed: ${error.message}`,
    });
  }
}

// Example usage in Express router
/*
{
  "rpcEndpoint": "https://api.mainnet-beta.solana.com",
  "privateKey": "your_base64_encoded_private_key",
  "collectionMint": "EJRG9dgrFhKwMbdr1zPx77hLoq2gG1sxD8wW5nWDNHwR",
  "metadata": {
    "name": "My NFT",
    "uri": "https://arweave.net/your-metadata-uri"
  },
  "recipient": "D4ScX2jf2nkb8ovbFfB8zorpnKrLTXcAXzsc2PZxK92U"
}
*/
